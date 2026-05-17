// Safety actions — block, report, unmatch.
//
// All three are paired with the destructive UI flows in ChatScreen and
// SettingsScreen. They were alert-only before; this service writes the
// rows that the safety/abuse review pipeline expects.
//
// Migrations:
//   - Block / Report tables: 00005_social_safety.sql
//   - unmatch_user RPC:      00012_posts_safety_unmatch.sql

import { supabase } from '../../config/supabase';

async function currentAppUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');
  const { data: appUser, error } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (error) throw error;
  return appUser.id;
}

/**
 * Block a user. Idempotent — repeated blocks of the same user collapse
 * onto the unique (blockerId, blockedId) index without erroring out.
 */
export async function blockUser(blockedId) {
  const blockerId = await currentAppUserId();
  const { error } = await supabase
    .from('Block')
    .upsert(
      { blockerId, blockedId },
      { onConflict: 'blockerId,blockedId', ignoreDuplicates: true },
    );
  if (error) throw error;
  return { ok: true };
}

export async function unblockUser(blockedId) {
  const blockerId = await currentAppUserId();
  const { error } = await supabase
    .from('Block')
    .delete()
    .eq('blockerId', blockerId)
    .eq('blockedId', blockedId);
  if (error) throw error;
  return { ok: true };
}

/**
 * File a report. Reason is a short free-form string; details optional.
 * Reporters cannot read other reports — RLS only lets them see their own.
 */
export async function reportUser({ reportedId, reason, details = null }) {
  const reporterId = await currentAppUserId();
  // De-dupe client-side: if this reporter already filed a report
  // against this user, skip the insert. The Report table has no DB
  // unique constraint (audit flagged it — server fix is a migration),
  // so without this check a spammer could file unlimited duplicates
  // and bloat the review queue. The returned row id matches the
  // existing report so callers that branch on `data?.id` still work.
  const { data: existing } = await supabase
    .from('Report')
    .select('id')
    .eq('reporterId', reporterId)
    .eq('reportedId', reportedId)
    .maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('Report')
    .insert({ reporterId, reportedId, reason, details })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Block + report in one call — used by the "Report & Block" affordance.
 * The report row is what review acts on; the block stops further DMs
 * even before the review concludes.
 */
export async function reportAndBlock({ reportedId, reason = 'unspecified', details = null }) {
  await reportUser({ reportedId, reason, details });
  await blockUser(reportedId);
  return { ok: true };
}

/**
 * Tear down a match: deletes Match + Conversation + ConversationMember
 * + Message rows in one transaction via the unmatch_user RPC. Argument
 * is the *peer's* User.id — the RPC looks up the corresponding Match by
 * the (me, other) pair so callers don't have to track the match row id.
 */
export async function unmatchUser(otherUserId) {
  const { error } = await supabase.rpc('unmatch_user', { other_user_id: otherUserId });
  if (error) throw error;
  return { ok: true };
}
