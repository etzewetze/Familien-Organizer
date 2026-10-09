export const deviceDefaults = { enabled: false, timeout: 180, action: 'sleep', keepAwake: true };
export function deviceConfig(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const timeout = Number(value.timeout);
  return { enabled: value.enabled === true, timeout: Number.isFinite(timeout) ? Math.max(30, Math.min(3600, Math.round(timeout))) : 180, action: value.action === 'photos' ? 'photos' : 'sleep', keepAwake: value.keepAwake !== false };
}
export function idleAction(config, { now, lastActivity, authenticated, hidden, blocked, mode }) {
  return config.enabled && authenticated && !hidden && !blocked && mode === 'active' && now - lastActivity >= config.timeout * 1000 ? config.action : '';
}
