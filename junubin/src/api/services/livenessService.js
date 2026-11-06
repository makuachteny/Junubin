// livenessService — thin wrapper over the face-liveness Edge Function.
//
// Two phases:
//   1. createSession()  → returns { sessionId, region }. The client SDK
//      (@aws-amplify/ui-react-native FaceLivenessDetector) consumes the
//      sessionId and drives the camera flow. AWS scores the result and
//      stores it under the same SessionId for retrieval.
//   2. getResult(sessionId) → returns { confidence, status, passed }.
//      We use `passed` (= status='SUCCEEDED' AND confidence >= threshold)
//      to decide whether to mark the VerificationRequest approved.
//
// Both calls return null on failure so the UI can gracefully fall
// back to the legacy admin-review path (selfie upload + manual
// approval) when the AWS env vars aren't configured on the server.

import { supabase } from '../../config/supabase';

export async function createLivenessSession() {
  try {
    const { data, error } = await supabase.functions.invoke('face-liveness', {
      body: { action: 'create' },
    });
    if (error || !data?.sessionId) return null;
    return { sessionId: String(data.sessionId), region: data.region || null };
  } catch {
    return null;
  }
}

export async function getLivenessResult(sessionId) {
  if (!sessionId) return null;
  try {
    const { data, error } = await supabase.functions.invoke('face-liveness', {
      body: { action: 'result', sessionId },
    });
    if (error || !data) return null;
    return {
      confidence: Number(data.confidence) || 0,
      status: String(data.status || 'UNKNOWN'),
      passed: !!data.passed,
    };
  } catch {
    return null;
  }
}
