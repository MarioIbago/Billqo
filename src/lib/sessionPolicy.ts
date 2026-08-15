export const SESSION_IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export function isSessionExpired(lastActiveAt: number | undefined, now = Date.now()): boolean {
  if (lastActiveAt === undefined || !Number.isFinite(lastActiveAt)) return false;
  if (lastActiveAt > now) return false;
  return now - lastActiveAt >= SESSION_IDLE_TIMEOUT_MS;
}
