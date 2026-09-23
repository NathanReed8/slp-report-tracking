const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateChecker } = require('./update-check');

function updaterThatEmits(event, value) {
  const updater = new EventEmitter();
  updater.calls = 0;
  updater.checkForUpdates = async () => {
    updater.calls += 1;
    updater.emit(event, value);
  };
  return updater;
}

test('development builds explain why checks are unavailable without contacting GitHub', async () => {
  const updater = updaterThatEmits('update-available', { version: '2.0.0' });
  const check = createUpdateChecker({ updater, isPackaged: () => false, getVersion: () => '1.0.0' });
  assert.deepEqual(await check(), { status: 'development' });
  assert.equal(updater.calls, 0);
});

test('manual check reports a newer release and cleans up listeners', async () => {
  const updater = updaterThatEmits('update-available', { version: '1.0.0-beta.4' });
  const check = createUpdateChecker({ updater, isPackaged: () => true, getVersion: () => '1.0.0-beta.3' });
  assert.equal(updater.calls, 0);
  assert.deepEqual(await check(), { status: 'available', version: '1.0.0-beta.4' });
  assert.equal(updater.listenerCount('update-available'), 0);
  assert.equal(updater.listenerCount('update-not-available'), 0);
});

test('manual check reports the installed version when up to date', async () => {
  const updater = updaterThatEmits('update-not-available');
  const check = createUpdateChecker({ updater, isPackaged: () => true, getVersion: () => '1.0.0-beta.3' });
  assert.deepEqual(await check(), { status: 'up-to-date', version: '1.0.0-beta.3' });
});

test('manual check reports updater failures and allows a retry', async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { throw new Error('network unavailable'); };
  const check = createUpdateChecker({ updater, isPackaged: () => true, getVersion: () => '1.0.0-beta.3' });
  assert.deepEqual(await check(), { status: 'error' });
  updater.checkForUpdates = async () => { updater.emit('update-not-available'); };
  assert.deepEqual(await check(), { status: 'up-to-date', version: '1.0.0-beta.3' });
});

test('overlapping clicks share one update request', async () => {
  const updater = new EventEmitter();
  let calls = 0;
  updater.checkForUpdates = async () => {
    calls += 1;
    queueMicrotask(() => updater.emit('update-not-available'));
  };
  const check = createUpdateChecker({ updater, isPackaged: () => true, getVersion: () => '1.0.0-beta.3' });
  const first = check();
  const second = check();
  assert.deepEqual(await Promise.all([first, second]), [
    { status: 'up-to-date', version: '1.0.0-beta.3' },
    { status: 'up-to-date', version: '1.0.0-beta.3' }
  ]);
  assert.equal(calls, 1);
});
