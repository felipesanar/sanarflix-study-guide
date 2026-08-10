// Helpers compartilhados das features de IA (gestor-ai-insights,
// ai-study-recommendation, analyze-error-patterns).
//
// Três decisões que valem para TODAS as chamadas:
//
// 1. STREAMING SEMPRE. Chamada bufferizada ao gateway fica em silêncio até o
//    modelo terminar; o host corta a request em ~2 min e a geração é cobrada
//    igual. Com `stream: true` os bytes fluem desde o primeiro delta e nada é
//    cortado. Quando o front só quer o resultado final, o stream é consumido
//    aqui dentro (`streamChatCompletion`) — o contrato HTTP com o front
//    continua sendo um JSON único.
// 2. NENHUM TIMER DE ABORT. Sem AbortSignal.timeout / setTimeout+abort: uma
//    geração abortada por timer é descartada mas cobrada. Cancelamento só por
//    ação do usuário, propagando o signal da request.
// 3. CACHE NO SERVIDOR. `sessionStorage` no front não protege F5, outra aba,
//    outro dispositivo nem o segundo gestor da mesma IES. O cache real vive em
//    public.ai_response_cache, escrito com service role.

export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Modelo de raciocínio para leituras que cruzam muitos números (gestor). */
export const AI_MODEL_RACIOCINIO = "google/gemini-3.1-pro-preview";
/** Modelo padrão, rápido, para tudo o mais. */
export const AI_MODEL_RAPIDO = "google/gemini-3.6-flash";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  tool?: ToolSchema;
  signal?: AbortSignal;
  /**
   * Chamado a cada delta recebido do gateway, com o ACUMULADO até ali. É o que
   * permite repassar a resposta em SSE para o front: a tela mostra a leitura
   * sendo escrita em vez de esperar o fim, e um corte por teto de tokens deixa
   * de ser "tudo ou nada" — o que já chegou continua na tela.
   */
  onDelta?: (parcial: { texto: string; toolArguments: string | null }) => void;
}


export class AiGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface StreamResult {
  /** Texto acumulado dos deltas de content. */
  texto: string;
  /** Argumentos acumulados do tool call, quando `tool` foi passado. */
  toolArguments: string | null;
  /** `length` = cortada por max_tokens; `stop`/`tool_calls` = resposta completa. */
  finishReason: string | null;

}

/**
 * Faz a chamada ao gateway com `stream: true` e acumula os deltas.
 * Erros do gateway (429/402/…) sobem como AiGatewayError, com o status para o
 * front repassar tal e qual.
 */
export async function streamChatCompletion(opts: StreamOptions): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    max_tokens: opts.maxTokens ?? 900,
    temperature: opts.temperature ?? 0.4,
  };

  if (opts.tool) {
    body.tools = [opts.tool];
    body.tool_choice = { type: "function", function: { name: opts.tool.function.name } };
  }

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Sem timer: só o cancelamento do próprio cliente aborta.
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    const detalhe = await response.text().catch(() => "");
    throw new AiGatewayError(response.status || 500, detalhe || "ai_gateway_error");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  let toolArguments = "";
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";

    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evento = JSON.parse(payload);
        const escolha = evento?.choices?.[0];
        const delta = escolha?.delta;
        let mudou = false;
        if (typeof delta?.content === "string") {
          texto += delta.content;
          mudou = true;
        }
        const argDelta = delta?.tool_calls?.[0]?.function?.arguments;
        if (typeof argDelta === "string") {
          toolArguments += argDelta;
          mudou = true;
        }
        if (typeof escolha?.finish_reason === "string") finishReason = escolha.finish_reason;
        if (mudou && opts.onDelta) {
          opts.onDelta({ texto, toolArguments: toolArguments ? toolArguments : null });
        }
      } catch {
        // delta parcial/keep-alive: ignorado de propósito.
      }
    }
  }


  /* `length` significa que o orçamento de tokens acabou ANTES do fim da
     resposta — nos modelos de raciocínio o pensamento consome o mesmo
     orçamento, então o corte chega sem aviso e os argumentos da tool voltam
     como JSON truncado. Sem este log, o sintoma na tela era só "não foi
     possível montar a leitura", sem dizer que faltou teto. */
  if (finishReason === "length") {
    console.error(
      "[ai] resposta truncada por max_tokens",
      JSON.stringify({ model: opts.model, maxTokens: body.max_tokens, comTool: Boolean(opts.tool) }),
    );
  }

  return { texto: texto.trim(), toolArguments: toolArguments ? toolArguments : null, finishReason };
}


/** Extrai o objeto JSON de um texto (rede de segurança, não mecanismo principal). */
export function extrairJson<T = unknown>(bruto: string): T | null {
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(bruto.slice(inicio, fim + 1)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache no servidor
// ---------------------------------------------------------------------------

export async function hashChave(partes: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(partes));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function lerCache(
  supabaseAdmin: any,
  cacheKey: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_response_cache")
    .select("payload, expires_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as Record<string, unknown>;
}

export async function gravarCache(
  supabaseAdmin: any,
  entrada: {
    cacheKey: string;
    fn: string;
    modo: string;
    payload: Record<string, unknown>;
    model: string;
    ttlSegundos: number;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + entrada.ttlSegundos * 1000).toISOString();
  const { error } = await supabaseAdmin.from("ai_response_cache").upsert(
    {
      cache_key: entrada.cacheKey,
      fn: entrada.fn,
      modo: entrada.modo,
      payload: entrada.payload,
      model: entrada.model,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
  if (error) console.error("[ai-cache]", "falha ao gravar cache:", error.message);
}

/** TTLs por natureza do dado (segundos). */
export const TTL = {
  /** Recorte de IES/semestre/simulados: só muda quando entra simulado novo. */
  gestorRecorte: 60 * 60 * 12,
  /** Aluno individual visto pelo gestor. */
  gestorAluno: 60 * 60 * 6,
  /** Tutor do aluno: agenda e progresso mudam no dia. */
  aluno: 60 * 60 * 2,
  /** Caderno de erros: muda a cada registro novo (a chave já inclui o conteúdo). */
  cadernoErros: 60 * 60 * 6,
} as const;
