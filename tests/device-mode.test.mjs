import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceConfig, idleAction } from '../public/device-mode.js';
import { isEmoji, emojis, findEmojis } from '../public/symbols.js';

test('Gerätemodus ist zunächst aus und begrenzt Zeiten auf 30 Sekunden bis eine Stunde', () => {
  assert.deepEqual(deviceConfig(), { enabled: false, timeout: 180, action: 'sleep', keepAwake: true });
  assert.equal(deviceConfig({ timeout: -1 }).timeout, 30); assert.equal(deviceConfig({ timeout: 999999 }).timeout, 3600); assert.equal(deviceConfig({ timeout: 'NaN' }).timeout, 180);
  assert.equal(deviceConfig({ enabled: 'true', action: 'evil' }).enabled, false); assert.equal(deviceConfig({ action: 'photos' }).action, 'photos'); assert.deepEqual(deviceConfig(null), deviceConfig());
});
test('Inaktivität wirkt erst nach dem Zeitlimit und nicht bei Formularen, abgemeldeten oder versteckten Geräten', () => {
  const config = deviceConfig({ enabled: true, timeout: 60, action: 'photos' });
  const state = { now: 60000, lastActivity: 0, authenticated: true, hidden: false, blocked: false, mode: 'active' };
  assert.equal(idleAction(config, state), 'photos'); assert.equal(idleAction(config, { ...state, now: 59999 }), '');
  for (const patch of [{ authenticated: false }, { hidden: true }, { blocked: true }, { mode: 'sleep' }, { mode: 'photos' }]) assert.equal(idleAction(config, { ...state, ...patch }), '');
  assert.equal(idleAction(deviceConfig(), state), '');
});
test('Emoji-Auswahl akzeptiert Hauttöne, Familien, Flaggen und Tastatur-Emojis, aber keine Texte oder HTML', () => {
  for (const emoji of ['', '🎂', '👨‍👩‍👧‍👦', '👍🏽', '🇩🇪', '1️⃣', '❤️', '🫶']) assert.equal(isEmoji(emoji), true, emoji);
  for (const value of ['Hallo', '<script>', '🎂🎉', 'A', null, '😀'.repeat(40)]) assert.equal(isEmoji(value), false, String(value));
  for (const item of emojis) assert.equal(isEmoji(item.emoji), true, item.emoji);
  assert.ok(findEmojis('geburtstag').some(item => item.emoji === '🎂')); assert.ok(findEmojis('', 'food').every(item => item.category === 'food')); assert.equal(findEmojis('zz-no-match').length, 0);
});
