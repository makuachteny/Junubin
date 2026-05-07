// AnaJunubin — Game Engine (Pure Logic, No React)
// Manages game session state, answer processing, and chat serialization.

import { GAME_TYPES, GAME_CATALOG, getRandomQuestions } from '../data/games';

/**
 * Creates a new game session with randomized questions.
 */
export function createGameSession(gameType, customQuestions = []) {
  const catalog = GAME_CATALOG.find((g) => g.type === gameType);
  if (!catalog) return null;

  const questions = getRandomQuestions(gameType, catalog.roundCount, customQuestions);
  const id = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    type: gameType,
    name: catalog.name,
    emoji: catalog.emoji,
    color: catalog.color,
    round: 0,
    totalRounds: questions.length,
    questions,
    myAnswers: [],
    theirAnswers: [],
    status: 'playing', // playing | waiting | revealed | complete
  };
}

/**
 * Records the local user's answer for the current round.
 */
export function processMyAnswer(session, answer) {
  if (session.status === 'complete') return session;

  const myAnswers = [...session.myAnswers];
  myAnswers[session.round] = answer;

  const theirAnswer = session.theirAnswers[session.round];
  const bothAnswered = theirAnswer !== undefined;

  return {
    ...session,
    myAnswers,
    status: bothAnswered ? 'revealed' : 'waiting',
    ...((!bothAnswered) ? { waitingSince: Date.now() } : {}),
  };
}

/**
 * Records the other user's answer for the current round.
 */
export function processTheirAnswer(session, answer) {
  if (session.status === 'complete') return session;

  const theirAnswers = [...session.theirAnswers];
  theirAnswers[session.round] = answer;

  const myAnswer = session.myAnswers[session.round];
  const bothAnswered = myAnswer !== undefined;

  return {
    ...session,
    theirAnswers,
    status: bothAnswered ? 'revealed' : session.status,
  };
}

/**
 * Advances to the next round or marks game as complete.
 */
export function advanceRound(session) {
  const nextRound = session.round + 1;
  if (nextRound >= session.totalRounds) {
    return { ...session, status: 'complete', round: session.round };
  }
  return { ...session, round: nextRound, status: 'playing' };
}

/**
 * Computes the final game result.
 */
export function computeResult(session) {
  const { type, myAnswers, theirAnswers, questions } = session;

  if (type === GAME_TYPES.trivia) {
    let myScore = 0;
    let theirScore = 0;
    questions.forEach((q, i) => {
      if (myAnswers[i] === q.correctIndex) myScore++;
      if (theirAnswers[i] === q.correctIndex) theirScore++;
    });
    return { myScore, theirScore, total: questions.length, winner: myScore > theirScore ? 'me' : myScore < theirScore ? 'them' : 'tie' };
  }

  // For this_or_that, vibe_check, would_you_rather — match percentage
  let matches = 0;
  const answered = Math.min(myAnswers.length, theirAnswers.length);
  for (let i = 0; i < answered; i++) {
    if (myAnswers[i] === theirAnswers[i]) matches++;
  }
  const matchPercent = answered > 0 ? Math.round((matches / answered) * 100) : 0;
  return { matches, total: answered, matchPercent };
}

/**
 * Serializes a game session into a JSON string for chat transport.
 * Includes full questions array so the receiver can create a matching session.
 */
export function serializeGameMessage(session) {
  return JSON.stringify({
    gameId: session.id,
    type: session.type,
    name: session.name,
    emoji: session.emoji,
    color: session.color,
    round: session.round,
    totalRounds: session.totalRounds,
    questions: session.questions,
    myAnswers: session.myAnswers,
    status: session.status,
  });
}

/**
 * Deserializes a game message body from chat transport.
 */
export function deserializeGameMessage(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Creates a game session from a received invitation (for the receiving user).
 * Their "myAnswers" become our "theirAnswers" since perspectives are flipped.
 */
export function createSessionFromInvite(gameData) {
  if (!gameData?.gameId || !gameData?.questions) return null;
  return {
    id: gameData.gameId,
    type: gameData.type,
    name: gameData.name,
    emoji: gameData.emoji,
    color: gameData.color,
    round: gameData.round || 0,
    totalRounds: gameData.totalRounds,
    questions: gameData.questions,
    myAnswers: [],
    theirAnswers: gameData.myAnswers || [],
    status: 'playing',
  };
}

/**
 * Returns true if the session has been in 'waiting' status beyond the timeout.
 */
export function isTimedOut(session, timeoutMs = 120000) {
  return (
    session.status === 'waiting' &&
    typeof session.waitingSince === 'number' &&
    Date.now() - session.waitingSince >= timeoutMs
  );
}

/**
 * Marks a session as timed out.
 */
export function markTimedOut(session) {
  return { ...session, status: 'timed_out' };
}

/**
 * Returns a human-readable round summary string.
 */
export function roundSummaryText(session, roundIndex) {
  const { type, myAnswers, theirAnswers, questions } = session;
  const round = roundIndex + 1;
  const myAns = myAnswers[roundIndex];
  const theirAns = theirAnswers[roundIndex];

  if (myAns === undefined || theirAns === undefined) {
    return `Round ${round}: No answers recorded`;
  }

  if (type === GAME_TYPES.trivia) {
    const q = questions[roundIndex];
    const myCorrect = myAns === q?.correctIndex;
    const theirCorrect = theirAns === q?.correctIndex;
    if (myCorrect && theirCorrect) return `Round ${round}: You both got it right!`;
    if (myCorrect) return `Round ${round}: You got it, they missed!`;
    if (theirCorrect) return `Round ${round}: They got it, you missed!`;
    return `Round ${round}: You both missed!`;
  }

  if (myAns === theirAns) return `Round ${round}: You both picked the same!`;
  return `Round ${round}: Different vibes this time`;
}

/**
 * Serializes a Map of active games into an array for AsyncStorage persistence.
 */
export function serializeActiveGames(gamesMap) {
  return Array.from(gamesMap.entries()).map(([id, session]) => ({
    ...session,
    id,
  }));
}

/**
 * Deserializes an array back into a Map of active game sessions.
 */
export function deserializeActiveGames(arr) {
  const map = new Map();
  if (!Array.isArray(arr)) return map;
  for (const session of arr) {
    if (session?.id) map.set(session.id, session);
  }
  return map;
}
