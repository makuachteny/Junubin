import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENTS_KEY = '@junubin_events';
const ATTENDEES_KEY = '@junubin_event_attendees';
const PAYOUTS_KEY = '@junubin_event_payouts';

const readJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

export async function getEvents() {
  return readJson(EVENTS_KEY, []);
}

export async function saveEvent(event) {
  const events = await readJson(EVENTS_KEY, []);
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    events[idx] = { ...events[idx], ...event };
  } else {
    events.push(event);
  }
  await writeJson(EVENTS_KEY, events);
  return event;
}

export async function getAttendees(eventId) {
  const map = await readJson(ATTENDEES_KEY, {});
  return map[eventId] || [];
}

const setAttendees = async (eventId, attendees) => {
  const map = await readJson(ATTENDEES_KEY, {});
  map[eventId] = attendees;
  await writeJson(ATTENDEES_KEY, map);
};

const getPayouts = async () => readJson(PAYOUTS_KEY, {});

const setPayouts = async (eventId, payout) => {
  const map = await readJson(PAYOUTS_KEY, {});
  map[eventId] = payout;
  await writeJson(PAYOUTS_KEY, map);
};

export async function isAttending(eventId, userId) {
  const attendees = await getAttendees(eventId);
  return attendees.some((a) => a.userId === userId);
}

// 10-char alphanumeric ticket code, dash-separated for readability at the door.
// e.g. "JNB-A2K9-X7P3". Excludes ambiguous chars (0/O, 1/I) to reduce mis-reads.
function generateTicketCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n) => Array.from({ length: n }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
  return `JNB-${pick(4)}-${pick(4)}`;
}

export async function registerFree(eventId, user) {
  const attendees = await getAttendees(eventId);
  if (attendees.some((a) => a.userId === user.id)) return { ok: false, reason: 'already' };
  const attendee = {
    id: `att_${Date.now()}`,
    userId: user.id,
    name: user.name || 'User',
    paid: false,
    amount: 0,
    ticketCode: generateTicketCode(),
    createdAt: Date.now(),
  };
  attendees.push(attendee);
  await setAttendees(eventId, attendees);
  return { ok: true, attendee };
}

export async function purchaseTicket(eventId, user, amount) {
  const attendees = await getAttendees(eventId);
  if (attendees.some((a) => a.userId === user.id)) return { ok: false, reason: 'already' };
  const attendee = {
    id: `att_${Date.now()}`,
    userId: user.id,
    name: user.name || 'User',
    paid: true,
    amount: amount || 0,
    ticketCode: generateTicketCode(),
    createdAt: Date.now(),
  };
  attendees.push(attendee);
  await setAttendees(eventId, attendees);

  const payouts = await getPayouts();
  const current = payouts[eventId] || { totalRevenue: 0, withdrawn: 0 };
  current.totalRevenue += amount || 0;
  payouts[eventId] = current;
  await writeJson(PAYOUTS_KEY, payouts);
  return { ok: true, attendee };
}

// Returns the current user's attendee record for an event, including the
// ticket code that the door staff will scan/check at entry. Used by
// EventDetailScreen + TicketScreen.
export async function getMyAttendee(eventId, userId) {
  const attendees = await getAttendees(eventId);
  return attendees.find((a) => a.userId === userId) || null;
}

// Walk the attendee map, pick out every entry that belongs to userId, and
// pair it with the corresponding event so the UI has everything it needs to
// render a printable ticket without a second lookup.
export async function getMyTickets(userId) {
  if (!userId) return [];
  const events = await readJson(EVENTS_KEY, []);
  const attendeeMap = await readJson(ATTENDEES_KEY, {});
  const tickets = [];
  for (const event of events) {
    const list = attendeeMap[event.id] || [];
    const mine = list.find((a) => a.userId === userId);
    if (mine) tickets.push({ event, attendee: mine });
  }
  // Most recent RSVPs first.
  tickets.sort((a, b) => (b.attendee.createdAt || 0) - (a.attendee.createdAt || 0));
  return tickets;
}

export async function cancelRegistration(eventId, userId) {
  const attendees = await getAttendees(eventId);
  const idx = attendees.findIndex((a) => a.userId === userId);
  if (idx === -1) return { ok: false };
  const [removed] = attendees.splice(idx, 1);
  await setAttendees(eventId, attendees);

  if (removed?.paid) {
    const payouts = await getPayouts();
    const current = payouts[eventId] || { totalRevenue: 0, withdrawn: 0 };
    current.totalRevenue = Math.max((current.totalRevenue || 0) - (removed.amount || 0), 0);
    if (current.withdrawn > current.totalRevenue) {
      current.withdrawn = current.totalRevenue;
    }
    payouts[eventId] = current;
    await writeJson(PAYOUTS_KEY, payouts);
  }
  return { ok: true };
}

export async function getEventStats(eventId) {
  const attendees = await getAttendees(eventId);
  const payouts = await getPayouts();
  const payout = payouts[eventId] || { totalRevenue: 0, withdrawn: 0 };
  const ticketsSold = attendees.filter((a) => a.paid).length;
  const attendeesCount = attendees.length;
  const revenue = payout.totalRevenue || 0;
  const withdrawn = payout.withdrawn || 0;
  const available = Math.max(revenue - withdrawn, 0);
  return { attendeesCount, ticketsSold, revenue, withdrawn, available };
}

export async function withdraw(eventId, amount) {
  const payouts = await getPayouts();
  const current = payouts[eventId] || { totalRevenue: 0, withdrawn: 0 };
  const available = Math.max((current.totalRevenue || 0) - (current.withdrawn || 0), 0);
  const toWithdraw = Math.min(amount, available);
  current.withdrawn = (current.withdrawn || 0) + toWithdraw;
  payouts[eventId] = current;
  await writeJson(PAYOUTS_KEY, payouts);
  return { ok: true, withdrawn: toWithdraw };
}

export async function enrichEvents(events) {
  const enriched = await Promise.all(events.map(async (event) => {
    const stats = await getEventStats(event.id);
    const ticketsTotal = event.ticketsTotal ?? event.ticketsRemaining ?? null;
    const ticketsRemaining = ticketsTotal != null
      ? Math.max(ticketsTotal - stats.ticketsSold, 0)
      : event.ticketsRemaining;
    return {
      ...event,
      attendees: stats.attendeesCount ?? event.attendees,
      ticketsRemaining,
    };
  }));
  return enriched;
}
