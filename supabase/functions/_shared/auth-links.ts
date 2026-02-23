/**
 * Canonical auth link builder.
 * Ensures all recovery/invite links always point to academy.sanar.com.br,
 * regardless of Supabase Auth configuration or legacy domain settings.
 */

const CANONICAL_ORIGIN = 'https://academy.sanar.com.br';
const LEGACY_HOSTNAMES = ['guiadeestudos.sanar.com.br', 'www.guiadeestudos.sanar.com.br'];

interface GenerateLinkProperties {
  action_link?: string;
  hashed_token?: string;
  token_hash?: string;       // older SDK versions
  verification_type?: string;
  redirect_to?: string;
}

interface BuildCanonicalLinkOptions {
  /** Properties returned by supabaseAdmin.auth.admin.generateLink() → data.properties */
  properties: GenerateLinkProperties;
  /** The redirect path the user should land on after token verification */
  redirectPath?: string;
  /** Supabase project URL (defaults to env) */
  supabaseUrl?: string;
}

/**
 * Builds a canonical confirmation URL that always resolves to academy.sanar.com.br.
 *
 * Strategy:
 *  1. If `hashed_token` / `token_hash` is available, build a deterministic
 *     Supabase verify URL with the correct redirect_to.
 *  2. Otherwise, normalize `action_link` by replacing legacy hostnames
 *     and fixing any redirect_to params embedded in the querystring.
 *  3. Fallback: return a static canonical URL.
 */
export function buildCanonicalLink(opts: BuildCanonicalLinkOptions): string {
  const redirectPath = opts.redirectPath ?? '/auth/update-password';
  const supabaseUrl = opts.supabaseUrl ?? Deno.env.get('SUPABASE_URL') ?? '';
  const props = opts.properties ?? {};
  const tokenHash = props.hashed_token ?? props.token_hash;
  const fallback = `${CANONICAL_ORIGIN}${redirectPath}`;

  let finalUrl: string;

  // Strategy 1: Build deterministic URL from token_hash
  if (tokenHash && supabaseUrl) {
    const redirectTo = encodeURIComponent(`${CANONICAL_ORIGIN}${redirectPath}`);
    const type = props.verification_type ?? 'recovery';
    finalUrl = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${redirectTo}`;
    console.log('[auth-links] Built URL from token_hash. Source: token_hash');
  }
  // Strategy 2: Normalize action_link
  else if (props.action_link) {
    finalUrl = normalizeUrl(props.action_link, redirectPath);
    console.log('[auth-links] Built URL from action_link (normalized). Source: action_link');
  }
  // Strategy 3: Static fallback
  else {
    console.log('[auth-links] No token_hash or action_link available. Using static fallback.');
    return fallback;
  }

  // Log final hostname (safe, no tokens)
  try {
    const parsed = new URL(finalUrl);
    console.log(`[auth-links] Final hostname: ${parsed.hostname}, redirect path: ${redirectPath}`);
  } catch {
    // URL parsing failed — still return what we have
  }

  return finalUrl;
}

/**
 * Normalizes a URL by replacing legacy hostnames with the canonical origin,
 * both at the top-level URL and inside any redirect_to query parameter.
 */
function normalizeUrl(url: string, redirectPath: string): string {
  try {
    const parsed = new URL(url);

    // Fix top-level hostname
    if (isLegacyHostname(parsed.hostname)) {
      parsed.protocol = 'https:';
      parsed.hostname = new URL(CANONICAL_ORIGIN).hostname;
    }

    // Fix redirect_to in query params (may be URL-encoded)
    const redirectTo = parsed.searchParams.get('redirect_to');
    if (redirectTo) {
      const decodedRedirectTo = decodeURIComponent(redirectTo);
      try {
        const redirectParsed = new URL(decodedRedirectTo);
        if (isLegacyHostname(redirectParsed.hostname)) {
          redirectParsed.protocol = 'https:';
          redirectParsed.hostname = new URL(CANONICAL_ORIGIN).hostname;
          parsed.searchParams.set('redirect_to', redirectParsed.toString());
        }
      } catch {
        // redirect_to is not a full URL, force canonical
        parsed.searchParams.set('redirect_to', `${CANONICAL_ORIGIN}${redirectPath}`);
      }
    }

    return parsed.toString();
  } catch {
    // If URL parsing completely fails, do a simple string replacement
    let result = url;
    for (const legacy of LEGACY_HOSTNAMES) {
      result = result.replaceAll(legacy, new URL(CANONICAL_ORIGIN).hostname);
    }
    return result;
  }
}

function isLegacyHostname(hostname: string): boolean {
  return LEGACY_HOSTNAMES.includes(hostname.toLowerCase());
}
