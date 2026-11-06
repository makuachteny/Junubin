// One rule for "which photos may be shown", applied at every read path.
//
// Photo.moderationStatus (migration 00050) is written by the
// moderate-image Edge Function. We hide 'rejected' and nothing else:
//
//   'pending'  — the state between upload and the provider answering.
//                Hiding it would make a fresh upload vanish for a few
//                seconds, or permanently if MODERATION_PROVIDER is
//                unset and the function 503s. A moderation outage must
//                never become an "everyone's photos disappeared"
//                outage.
//   'flagged'  — soft-label band, a human-review queue rather than a
//                verdict. Post treats it the same way.
//   'rejected' — hard hit above the reject threshold. Gone.
//
// Rows with no `moderationStatus` at all are KEPT. That is the shape
// every row has before migration 00050 is applied, and the shape a
// legacy client would send. Defaulting the unknown case to "hide"
// would blank every photo in the app the moment this code shipped
// ahead of the migration — a far worse failure than briefly showing an
// unscanned photo that was already live.

export const REJECTED = 'rejected';

export const isPhotoVisible = (photo) =>
  !!photo && photo.moderationStatus !== REJECTED;

/**
 * Filter a photo array to what may be displayed. Non-array input
 * returns [] so callers can drop their own `Array.isArray` guards.
 */
export function visiblePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.filter(isPhotoVisible);
}
