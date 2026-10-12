export interface ReplayOperation {
  state: string;
  createdAt: number;
  attempts: number;
  lastSubmittedAt?: number;
  nextStatusAt?: number;
  pollDelayMs?: number;
}
export function shouldSubmitOperation(
  operation: ReplayOperation,
  now = Date.now(),
) {
  return (
    operation.state === 'pending' ||
    (operation.state === 'sending' &&
      now - (operation.lastSubmittedAt || operation.createdAt) >= 60000) ||
    (operation.state === 'accepted' &&
      now - (operation.lastSubmittedAt || operation.createdAt) >= 604800000)
  );
}
export function shouldPollOperation(
  operation: ReplayOperation,
  now = Date.now(),
) {
  return (
    ['sending', 'accepted'].includes(operation.state) &&
    (operation.nextStatusAt || 0) <= now
  );
}
export function nextStatusSchedule(
  operation: ReplayOperation,
  now = Date.now(),
  retryAfterMs = 0,
) {
  const pollDelayMs = Math.min(
    60000,
    Math.max(5000, (operation.pollDelayMs || 2500) * 2),
  );
  return {
    pollDelayMs,
    nextStatusAt: now + Math.max(pollDelayMs, retryAfterMs),
  };
}
