// Safety service — additional client-side helpers for the safety
// edge functions (separated from safetyService.js so that file stays
// focused on the block / report / unmatch CRUD it owned originally).
//
// Today: detectScamSignal — wraps the detect-scam-signal Edge Function.
// Caller (ChatScreen) passes a conversationId and gets back a verdict
// of shape { risk, confidence, signals, message }. The function is
// already membership-gated server-side so we don't need to revalidate
// here.

import { supabase } from '../../config/supabase';

/**
 * Ask the server to score the given conversation for romance-scam
 * patterns. Returns the verdict or null on failure (network blip, no
 * provider configured, etc). Callers must treat null as "no banner."
 *
 * Throttled implicitly by the call sites — ChatScreen calls this on
 * mount and after every N new incoming messages, not on every render.
 */
export async function detectScamSignal(conversationId) {
  if (!conversationId) return null;
  try {
    const { data, error } = await supabase.functions.invoke('detect-scam-signal', {
      body: { conversationId },
    });
    if (error) return null;
    if (!data || typeof data !== 'object') return null;
    // Normalize so the consumer can render unconditionally.
    return {
      risk: data.risk === 'high' || data.risk === 'medium' ? data.risk : 'low',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      signals: Array.isArray(data.signals) ? data.signals : [],
      message: typeof data.message === 'string' ? data.message : '',
    };
  } catch {
    return null;
  }
}
