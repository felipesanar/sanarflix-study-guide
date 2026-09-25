import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeResposta } from "./index.ts";

Deno.test("uma letra", () => {
  assertEquals(normalizeResposta("b", "A"), "B");
  assertEquals(normalizeResposta("Alternativa C", "A"), "C");
  assertEquals(normalizeResposta("", "A"), null);
});

Deno.test("marcação dupla com gabarito mantém a outra", () => {
  assertEquals(normalizeResposta("(A/D)", "A"), "D");
  assertEquals(normalizeResposta("(A/D)", "D"), "A");
});

Deno.test("marcação dupla sem gabarito mantém a primeira", () => {
  assertEquals(normalizeResposta("(A/D)", "C"), "A");
  assertEquals(normalizeResposta("B,E", "C"), "B");
});
