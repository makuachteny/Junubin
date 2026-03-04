import {
  createGameSession,
  createSessionFromInvite,
  processMyAnswer,
  processTheirAnswer,
  advanceRound,
  computeResult,
  serializeGameMessage,
  deserializeGameMessage,
  isTimedOut,
  markTimedOut,
  roundSummaryText,
  serializeActiveGames,
  deserializeActiveGames,
} from '../gameEngine';
import { GAME_TYPES, getRandomQuestions } from '../../data/games';

// ── Session Creation ──

describe('createGameSession', () => {
  it('creates a valid session with correct structure', () => {
    const session = createGameSession(GAME_TYPES.this_or_that);
    expect(session).not.toBeNull();
    expect(session.id).toMatch(/^game_/);
    expect(session.type).toBe(GAME_TYPES.this_or_that);
    expect(session.name).toBe('This or That');
    expect(session.round).toBe(0);
    expect(session.totalRounds).toBe(5);
    expect(session.questions).toHaveLength(5);
    expect(session.myAnswers).toEqual([]);
    expect(session.theirAnswers).toEqual([]);
    expect(session.status).toBe('playing');
  });

  it('creates sessions for all game types', () => {
    Object.values(GAME_TYPES).forEach((type) => {
      const session = createGameSession(type);
      expect(session).not.toBeNull();
      expect(session.type).toBe(type);
      expect(session.questions.length).toBeGreaterThan(0);
    });
  });

  it('returns null for invalid game type', () => {
    expect(createGameSession('nonexistent')).toBeNull();
  });

  it('merges custom questions into the pool', () => {
    const custom = [
      { id: 'c1', optionA: 'Custom A', optionB: 'Custom B' },
      { id: 'c2', optionA: 'Custom C', optionB: 'Custom D' },
    ];
    const session = createGameSession(GAME_TYPES.this_or_that, custom);
    // Questions are shuffled, but total pool is bigger — so 5 drawn from bank + custom
    expect(session.questions).toHaveLength(5);
  });
});

// ── getRandomQuestions with custom ──

describe('getRandomQuestions', () => {
  it('merges custom questions into the bank before shuffle', () => {
    const custom = [
      { id: 'x1', optionA: 'X', optionB: 'Y' },
    ];
    // Repeat many times to verify custom can appear
    let found = false;
    for (let i = 0; i < 50; i++) {
      const qs = getRandomQuestions(GAME_TYPES.this_or_that, 15, custom);
      if (qs.some((q) => q.id === 'x1')) { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

// ── Two-Player Flow: This or That ──

describe('two-player this_or_that game flow', () => {
  let sessionA; // User A's perspective
  let sessionB; // User B's perspective

  beforeEach(() => {
    sessionA = createGameSession(GAME_TYPES.this_or_that);
    // Simulate User B receiving the invite via createSessionFromInvite
    const serialized = serializeGameMessage(sessionA);
    const gameData = deserializeGameMessage(serialized);
    sessionB = createSessionFromInvite(gameData);
  });

  it('User B creates a matching session from invite', () => {
    expect(sessionB).not.toBeNull();
    expect(sessionB.id).toBe(sessionA.id);
    expect(sessionB.type).toBe(sessionA.type);
    expect(sessionB.questions).toEqual(sessionA.questions);
    expect(sessionB.totalRounds).toBe(sessionA.totalRounds);
    expect(sessionB.myAnswers).toEqual([]);
    expect(sessionB.theirAnswers).toEqual([]);
    expect(sessionB.status).toBe('playing');
  });

  it('full 5-round game flows to completion', () => {
    for (let round = 0; round < 5; round++) {
      // Both users answer
      const answerA = 'A';
      const answerB = round % 2 === 0 ? 'A' : 'B'; // Mix of match/different

      // User A answers
      sessionA = processMyAnswer(sessionA, answerA);
      expect(sessionA.status).toBe('waiting');

      // User B answers
      sessionB = processMyAnswer(sessionB, answerB);
      expect(sessionB.status).toBe('waiting');

      // Simulate realtime: User A receives B's answer
      sessionA = processTheirAnswer(sessionA, answerB);
      expect(sessionA.status).toBe('revealed');

      // Simulate realtime: User B receives A's answer
      sessionB = processTheirAnswer(sessionB, answerA);
      expect(sessionB.status).toBe('revealed');

      // Both advance
      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);

      if (round < 4) {
        expect(sessionA.status).toBe('playing');
        expect(sessionA.round).toBe(round + 1);
      } else {
        expect(sessionA.status).toBe('complete');
        expect(sessionB.status).toBe('complete');
      }
    }

    // Verify results
    const resultA = computeResult(sessionA);
    const resultB = computeResult(sessionB);
    // User B's theirAnswers are User A's myAnswers (flipped perspective)
    // Both see same match percentage
    expect(resultA.matchPercent).toBe(resultB.matchPercent);
    // 3 out of 5 match (rounds 0, 2, 4 both 'A'; rounds 1, 3 different)
    expect(resultA.matchPercent).toBe(60);
  });

  it('handles User B answering first (async)', () => {
    // User B answers first
    sessionB = processMyAnswer(sessionB, 'B');
    expect(sessionB.status).toBe('waiting');

    // User A answers second
    sessionA = processMyAnswer(sessionA, 'A');
    expect(sessionA.status).toBe('waiting');

    // User A receives B's answer → revealed
    sessionA = processTheirAnswer(sessionA, 'B');
    expect(sessionA.status).toBe('revealed');

    // User B receives A's answer → revealed
    sessionB = processTheirAnswer(sessionB, 'A');
    expect(sessionB.status).toBe('revealed');
  });

  it('does not process answers after game is complete', () => {
    // Fast-forward to completion
    for (let r = 0; r < 5; r++) {
      sessionA = processMyAnswer(sessionA, 'A');
      sessionA = processTheirAnswer(sessionA, 'A');
      sessionA = advanceRound(sessionA);
    }
    expect(sessionA.status).toBe('complete');

    // Trying to answer again should be a no-op
    const before = { ...sessionA };
    sessionA = processMyAnswer(sessionA, 'B');
    expect(sessionA.myAnswers).toEqual(before.myAnswers);
    expect(sessionA.status).toBe('complete');
  });
});

// ── Two-Player Flow: Trivia ──

describe('two-player trivia game flow', () => {
  let sessionA;
  let sessionB;

  beforeEach(() => {
    sessionA = createGameSession(GAME_TYPES.trivia);
    const serialized = serializeGameMessage(sessionA);
    const gameData = deserializeGameMessage(serialized);
    sessionB = createSessionFromInvite(gameData);
  });

  it('trivia uses numeric answers and tracks scores', () => {
    for (let round = 0; round < 5; round++) {
      const q = sessionA.questions[round];
      const correctAnswer = q.correctIndex;
      const wrongAnswer = (correctAnswer + 1) % q.options.length;

      // User A always correct, User B always wrong
      sessionA = processMyAnswer(sessionA, correctAnswer);
      sessionB = processMyAnswer(sessionB, wrongAnswer);

      sessionA = processTheirAnswer(sessionA, wrongAnswer);
      sessionB = processTheirAnswer(sessionB, correctAnswer);

      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);
    }

    const resultA = computeResult(sessionA);
    expect(resultA.myScore).toBe(5);
    expect(resultA.theirScore).toBe(0);
    expect(resultA.winner).toBe('me');

    // From B's perspective, scores are flipped
    const resultB = computeResult(sessionB);
    expect(resultB.myScore).toBe(0);
    expect(resultB.theirScore).toBe(5);
    expect(resultB.winner).toBe('them');
  });

  it('trivia tie is detected', () => {
    for (let round = 0; round < 5; round++) {
      const q = sessionA.questions[round];
      // Both get the correct answer
      sessionA = processMyAnswer(sessionA, q.correctIndex);
      sessionA = processTheirAnswer(sessionA, q.correctIndex);
      sessionA = advanceRound(sessionA);
    }

    const result = computeResult(sessionA);
    expect(result.myScore).toBe(5);
    expect(result.theirScore).toBe(5);
    expect(result.winner).toBe('tie');
  });
});

// ── Two-Player Flow: Vibe Check ──

describe('two-player vibe_check game flow', () => {
  it('100% match when both answer identically', () => {
    let sessionA = createGameSession(GAME_TYPES.vibe_check);
    const serialized = serializeGameMessage(sessionA);
    let sessionB = createSessionFromInvite(deserializeGameMessage(serialized));

    for (let round = 0; round < 5; round++) {
      sessionA = processMyAnswer(sessionA, 'A');
      sessionB = processMyAnswer(sessionB, 'A');
      sessionA = processTheirAnswer(sessionA, 'A');
      sessionB = processTheirAnswer(sessionB, 'A');
      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);
    }

    const result = computeResult(sessionA);
    expect(result.matchPercent).toBe(100);
  });

  it('0% match when answers always differ', () => {
    let sessionA = createGameSession(GAME_TYPES.vibe_check);
    const serialized = serializeGameMessage(sessionA);
    let sessionB = createSessionFromInvite(deserializeGameMessage(serialized));

    for (let round = 0; round < 5; round++) {
      sessionA = processMyAnswer(sessionA, 'A');
      sessionB = processMyAnswer(sessionB, 'B');
      sessionA = processTheirAnswer(sessionA, 'B');
      sessionB = processTheirAnswer(sessionB, 'A');
      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);
    }

    const result = computeResult(sessionA);
    expect(result.matchPercent).toBe(0);
  });
});

// ── Serialization / Deserialization ──

describe('serializeGameMessage / deserializeGameMessage', () => {
  it('round-trips a session correctly', () => {
    const session = createGameSession(GAME_TYPES.would_you_rather);
    const serialized = serializeGameMessage(session);
    const parsed = deserializeGameMessage(serialized);

    expect(parsed.gameId).toBe(session.id);
    expect(parsed.type).toBe(session.type);
    expect(parsed.questions).toEqual(session.questions);
    expect(parsed.totalRounds).toBe(session.totalRounds);
    expect(parsed.myAnswers).toEqual([]);
    expect(parsed.status).toBe('playing');
  });

  it('includes full questions array for receiver', () => {
    const session = createGameSession(GAME_TYPES.trivia);
    const serialized = serializeGameMessage(session);
    const parsed = deserializeGameMessage(serialized);

    expect(parsed.questions).toHaveLength(5);
    parsed.questions.forEach((q) => {
      expect(q.question).toBeDefined();
      expect(q.options).toHaveLength(4);
      expect(typeof q.correctIndex).toBe('number');
    });
  });

  it('preserves answers after answering', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    const serialized = serializeGameMessage(session);
    const parsed = deserializeGameMessage(serialized);

    expect(parsed.myAnswers).toEqual(['A']);
    expect(parsed.status).toBe('waiting');
  });

  it('handles malformed JSON gracefully', () => {
    expect(deserializeGameMessage('not json')).toBeNull();
    expect(deserializeGameMessage('')).toBeNull();
    expect(deserializeGameMessage(null)).toBeNull();
  });
});

// ── createSessionFromInvite ──

describe('createSessionFromInvite', () => {
  it('creates a session with flipped perspective', () => {
    const sessionA = createGameSession(GAME_TYPES.this_or_that);
    // User A answers round 0
    const answered = processMyAnswer(sessionA, 'B');
    const serialized = serializeGameMessage(answered);
    const gameData = deserializeGameMessage(serialized);

    const sessionB = createSessionFromInvite(gameData);
    expect(sessionB.id).toBe(sessionA.id);
    expect(sessionB.myAnswers).toEqual([]); // User B hasn't answered yet
    expect(sessionB.theirAnswers).toEqual(['B']); // User A's answer becomes B's theirAnswers
    expect(sessionB.questions).toEqual(sessionA.questions);
    expect(sessionB.status).toBe('playing'); // Ready for User B to play
  });

  it('returns null for incomplete data', () => {
    expect(createSessionFromInvite(null)).toBeNull();
    expect(createSessionFromInvite({})).toBeNull();
    expect(createSessionFromInvite({ gameId: 'x' })).toBeNull(); // No questions
  });

  it('preserves question integrity for all game types', () => {
    Object.values(GAME_TYPES).forEach((type) => {
      const sessionA = createGameSession(type);
      const data = deserializeGameMessage(serializeGameMessage(sessionA));
      const sessionB = createSessionFromInvite(data);

      expect(sessionB.questions).toHaveLength(sessionA.questions.length);
      sessionB.questions.forEach((q, i) => {
        expect(q).toEqual(sessionA.questions[i]);
      });
    });
  });

  it('handles invite where sender has already answered', () => {
    let sessionA = createGameSession(GAME_TYPES.this_or_that);
    sessionA = processMyAnswer(sessionA, 'A');
    sessionA = processMyAnswer({ ...sessionA, round: 0 }, 'A'); // re-answer same round

    const data = deserializeGameMessage(serializeGameMessage(sessionA));
    const sessionB = createSessionFromInvite(data);

    // B should see A's answers as their theirAnswers
    expect(sessionB.theirAnswers).toEqual(['A']);
    expect(sessionB.myAnswers).toEqual([]);
    // B should be able to play
    expect(sessionB.status).toBe('playing');
  });
});

// ── advanceRound edge cases ──

describe('advanceRound', () => {
  it('increments round and resets to playing', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    session = processTheirAnswer(session, 'A');
    expect(session.status).toBe('revealed');

    session = advanceRound(session);
    expect(session.round).toBe(1);
    expect(session.status).toBe('playing');
  });

  it('marks complete when all rounds played', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    for (let r = 0; r < 5; r++) {
      session = processMyAnswer(session, 'A');
      session = processTheirAnswer(session, 'A');
      session = advanceRound(session);
    }
    expect(session.status).toBe('complete');
    expect(session.round).toBe(4); // stays on last round
  });
});

// ── computeResult edge cases ──

describe('computeResult', () => {
  it('handles empty answers gracefully', () => {
    const session = createGameSession(GAME_TYPES.this_or_that);
    const result = computeResult(session);
    expect(result.matchPercent).toBe(0);
    expect(result.total).toBe(0);
  });

  it('would_you_rather uses match percentage like this_or_that', () => {
    let session = createGameSession(GAME_TYPES.would_you_rather);
    for (let r = 0; r < 5; r++) {
      session = processMyAnswer(session, 'A');
      session = processTheirAnswer(session, 'A');
      session = advanceRound(session);
    }
    const result = computeResult(session);
    expect(result.matchPercent).toBe(100);
  });
});

// ── Full E2E: Two users playing a complete game via serialization ──

describe('E2E: two users playing via message transport', () => {
  it('simulates a complete game with serialized message exchange', () => {
    // User A creates game
    let sessionA = createGameSession(GAME_TYPES.this_or_that);
    const inviteMsg = serializeGameMessage(sessionA);

    // User B receives invite
    const inviteData = deserializeGameMessage(inviteMsg);
    let sessionB = createSessionFromInvite(inviteData);
    expect(sessionB.questions).toEqual(sessionA.questions);

    for (let round = 0; round < 5; round++) {
      // User A answers
      sessionA = processMyAnswer(sessionA, 'A');
      const msgFromA = serializeGameMessage(sessionA);

      // User B answers
      sessionB = processMyAnswer(sessionB, round < 3 ? 'A' : 'B');
      const msgFromB = serializeGameMessage(sessionB);

      // User B receives A's answer
      const aData = deserializeGameMessage(msgFromA);
      const aAnswer = aData.myAnswers[round];
      sessionB = processTheirAnswer(sessionB, aAnswer);
      expect(sessionB.status).toBe('revealed');

      // User A receives B's answer
      const bData = deserializeGameMessage(msgFromB);
      const bAnswer = bData.myAnswers[round];
      sessionA = processTheirAnswer(sessionA, bAnswer);
      expect(sessionA.status).toBe('revealed');

      // Both advance
      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);
    }

    expect(sessionA.status).toBe('complete');
    expect(sessionB.status).toBe('complete');

    const resultA = computeResult(sessionA);
    const resultB = computeResult(sessionB);
    // 3 out of 5 match: rounds 0-2 both A, rounds 3-4 differ
    expect(resultA.matchPercent).toBe(60);
    expect(resultB.matchPercent).toBe(60);
  });

  it('handles out-of-order answer arrival', () => {
    let sessionA = createGameSession(GAME_TYPES.vibe_check);
    let sessionB = createSessionFromInvite(
      deserializeGameMessage(serializeGameMessage(sessionA))
    );

    // User B answers FIRST
    sessionB = processMyAnswer(sessionB, 'B');
    expect(sessionB.status).toBe('waiting');

    // User A answers SECOND
    sessionA = processMyAnswer(sessionA, 'A');
    expect(sessionA.status).toBe('waiting');

    // Messages arrive:
    // A receives B's answer → revealed
    sessionA = processTheirAnswer(sessionA, 'B');
    expect(sessionA.status).toBe('revealed');

    // B receives A's answer → revealed
    sessionB = processTheirAnswer(sessionB, 'A');
    expect(sessionB.status).toBe('revealed');

    // Both users see correct answers
    expect(sessionA.myAnswers[0]).toBe('A');
    expect(sessionA.theirAnswers[0]).toBe('B');
    expect(sessionB.myAnswers[0]).toBe('B');
    expect(sessionB.theirAnswers[0]).toBe('A');
  });

  it('processTheirAnswer only writes to current round', () => {
    let sessionA = createGameSession(GAME_TYPES.this_or_that);
    // User A is on round 0
    expect(sessionA.round).toBe(0);

    // Apply answer for round 0
    sessionA = processTheirAnswer(sessionA, 'B');
    expect(sessionA.theirAnswers[0]).toBe('B');
    expect(sessionA.theirAnswers[1]).toBeUndefined();

    // processTheirAnswer always writes to session.round,
    // so calling again overwrites round 0
    sessionA = processTheirAnswer(sessionA, 'A');
    expect(sessionA.theirAnswers[0]).toBe('A');
  });

  it('duplicate answer is idempotent for same round', () => {
    let sessionA = createGameSession(GAME_TYPES.this_or_that);
    sessionA = processMyAnswer(sessionA, 'A');
    expect(sessionA.status).toBe('waiting');

    // Answer again with same value — still waiting (no partner)
    const before = sessionA;
    sessionA = processMyAnswer(sessionA, 'A');
    expect(sessionA.myAnswers[0]).toBe('A');
    expect(sessionA.status).toBe('waiting');
  });

  it('handles trivia E2E with correct score computation', () => {
    let sessionA = createGameSession(GAME_TYPES.trivia);
    let sessionB = createSessionFromInvite(
      deserializeGameMessage(serializeGameMessage(sessionA))
    );

    for (let round = 0; round < 5; round++) {
      const q = sessionA.questions[round];
      const correct = q.correctIndex;
      const wrong = (correct + 1) % 4;

      // A gets rounds 0-2 correct, B gets rounds 2-4 correct
      const aAnswer = round < 3 ? correct : wrong;
      const bAnswer = round >= 2 ? correct : wrong;

      sessionA = processMyAnswer(sessionA, aAnswer);
      sessionB = processMyAnswer(sessionB, bAnswer);
      sessionA = processTheirAnswer(sessionA, bAnswer);
      sessionB = processTheirAnswer(sessionB, aAnswer);
      sessionA = advanceRound(sessionA);
      sessionB = advanceRound(sessionB);
    }

    const resultA = computeResult(sessionA);
    expect(resultA.myScore).toBe(3);  // rounds 0, 1, 2
    expect(resultA.theirScore).toBe(3); // rounds 2, 3, 4

    const resultB = computeResult(sessionB);
    expect(resultB.myScore).toBe(3);  // rounds 2, 3, 4
    expect(resultB.theirScore).toBe(3); // rounds 0, 1, 2
    expect(resultB.winner).toBe('tie');
  });
});

// ── isTimedOut / markTimedOut ──

describe('isTimedOut', () => {
  it('returns false when status is not waiting', () => {
    const session = createGameSession(GAME_TYPES.this_or_that);
    expect(isTimedOut(session)).toBe(false);
  });

  it('returns false when waiting but within timeout', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    expect(session.status).toBe('waiting');
    expect(isTimedOut(session)).toBe(false);
  });

  it('returns true when waiting beyond timeout', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    session.waitingSince = Date.now() - 130000; // 130s ago
    expect(isTimedOut(session)).toBe(true);
  });

  it('respects custom timeout value', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    session.waitingSince = Date.now() - 5000;
    expect(isTimedOut(session, 3000)).toBe(true);
    expect(isTimedOut(session, 10000)).toBe(false);
  });
});

describe('markTimedOut', () => {
  it('sets status to timed_out', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    const timedOut = markTimedOut(session);
    expect(timedOut.status).toBe('timed_out');
    expect(timedOut.myAnswers).toEqual(session.myAnswers);
  });
});

// ── processMyAnswer sets waitingSince ──

describe('processMyAnswer waitingSince', () => {
  it('sets waitingSince when status becomes waiting', () => {
    const before = Date.now();
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    expect(session.status).toBe('waiting');
    expect(session.waitingSince).toBeGreaterThanOrEqual(before);
    expect(session.waitingSince).toBeLessThanOrEqual(Date.now());
  });

  it('does not set waitingSince when both answered (revealed)', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processTheirAnswer(session, 'B');
    session = processMyAnswer(session, 'A');
    expect(session.status).toBe('revealed');
    expect(session.waitingSince).toBeUndefined();
  });
});

// ── roundSummaryText ──

describe('roundSummaryText', () => {
  it('returns match text for this_or_that', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    session = processTheirAnswer(session, 'A');
    const text = roundSummaryText(session, 0);
    expect(text).toBe('Round 1: You both picked the same!');
  });

  it('returns different text for this_or_that', () => {
    let session = createGameSession(GAME_TYPES.this_or_that);
    session = processMyAnswer(session, 'A');
    session = processTheirAnswer(session, 'B');
    const text = roundSummaryText(session, 0);
    expect(text).toBe('Round 1: Different vibes this time');
  });

  it('returns trivia correct text', () => {
    let session = createGameSession(GAME_TYPES.trivia);
    const correct = session.questions[0].correctIndex;
    session = processMyAnswer(session, correct);
    session = processTheirAnswer(session, correct);
    const text = roundSummaryText(session, 0);
    expect(text).toBe('Round 1: You both got it right!');
  });

  it('returns trivia one-correct text', () => {
    let session = createGameSession(GAME_TYPES.trivia);
    const correct = session.questions[0].correctIndex;
    const wrong = (correct + 1) % 4;
    session = processMyAnswer(session, correct);
    session = processTheirAnswer(session, wrong);
    expect(roundSummaryText(session, 0)).toBe('Round 1: You got it, they missed!');
  });

  it('handles missing answers', () => {
    const session = createGameSession(GAME_TYPES.this_or_that);
    expect(roundSummaryText(session, 0)).toBe('Round 1: No answers recorded');
  });
});

// ── serializeActiveGames / deserializeActiveGames ──

describe('serializeActiveGames / deserializeActiveGames', () => {
  it('round-trips a Map correctly', () => {
    const sessionA = createGameSession(GAME_TYPES.this_or_that);
    const sessionB = createGameSession(GAME_TYPES.trivia);
    const map = new Map();
    map.set(sessionA.id, sessionA);
    map.set(sessionB.id, sessionB);

    const arr = serializeActiveGames(map);
    expect(arr).toHaveLength(2);

    const restored = deserializeActiveGames(arr);
    expect(restored.size).toBe(2);
    expect(restored.get(sessionA.id).type).toBe(GAME_TYPES.this_or_that);
    expect(restored.get(sessionB.id).type).toBe(GAME_TYPES.trivia);
  });

  it('handles empty Map', () => {
    const arr = serializeActiveGames(new Map());
    expect(arr).toEqual([]);
    const restored = deserializeActiveGames(arr);
    expect(restored.size).toBe(0);
  });

  it('handles invalid input', () => {
    expect(deserializeActiveGames(null).size).toBe(0);
    expect(deserializeActiveGames('bad').size).toBe(0);
    expect(deserializeActiveGames([{}]).size).toBe(0); // no id
  });
});
