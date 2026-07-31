export * as authService from './authService';
export * as profileService from './profileService';
export * as discoverService from './discoverService';
export * as chatService from './chatService';
export * as followService from './followService';
export * as safetyService from './safetyService';
// Conversations still read the legacy `Match` table — the rename to
// conversationService (and decoupling from Match) is a follow-up.
export * as matchesService from './matchesService';
// Social pivot (00047) — connections, message requests, people directory.
export * as connectionService from './connectionService';
export * as messageRequestService from './messageRequestService';
export * as directoryService from './directoryService';
