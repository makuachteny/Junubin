/**
 * AI shim — REMOVED.
 *
 * JuNubin does not use AI / LLMs. This module previously proxied to
 * Anthropic / OpenAI for chat completion; all provider code has been
 * removed. Nothing imports it anymore (assist-chat-opener was retired
 * and detect-scam-signal is now regex-only). Kept as an inert,
 * throw-on-use stub only because this environment can't delete the
 * file — safe to delete from the repo.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function isStubMode(): boolean {
  return true;
}

export function chatComplete(): Promise<string> {
  throw new Error("AI has been removed from JuNubin.");
}
