export function emitAnalyticsEvent(event, payload = {}) {
  const entry = {
    type: 'analytics',
    event,
    ts: new Date().toISOString(),
    ...payload,
  };

  console.info(JSON.stringify(entry));
}
