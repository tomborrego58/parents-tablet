const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../src/Data.js');

function installMockProps(initial = {}) {
  const store = { ...initial };
  global.PropertiesService = {
    getScriptProperties() {
      return {
        getProperty(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setProperty(k, v) { store[k] = String(v); }
      };
    }
  };
  global.LockService = {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  };
  return store;
}

test('isMedScheduledForDate handles daily, weekly (Sat), days (Mon/Thu), and prn', () => {
  const sat = new Date(2026, 10, 21); // Nov 21, 2026 = Saturday (6)
  const mon = new Date(2026, 10, 23); // Nov 23, 2026 = Monday (1)
  const thu = new Date(2026, 10, 26); // Nov 26, 2026 = Thursday (4)
  const tue = new Date(2026, 10, 24); // Nov 24, 2026 = Tuesday (2)

  assert.equal(data.isMedScheduledForDate({ freq: 'daily' }, mon), true);
  assert.equal(data.isMedScheduledForDate({ freq: 'prn' }, tue), true);

  const weeklySat = { freq: 'weekly', days: [6] };
  assert.equal(data.isMedScheduledForDate(weeklySat, sat), true);
  assert.equal(data.isMedScheduledForDate(weeklySat, mon), false);

  const monThu = { freq: 'days', days: [1, 4] };
  assert.equal(data.isMedScheduledForDate(monThu, mon), true);
  assert.equal(data.isMedScheduledForDate(monThu, thu), true);
  assert.equal(data.isMedScheduledForDate(monThu, tue), false);
});

test('toggleMedDose records and undoes dose timestamps in PropertiesService', () => {
  installMockProps();
  const now = new Date(2026, 10, 23, 8, 5, 0);

  const res1 = data.toggleMedDose('m1', '2026-11-23', now);
  assert.equal(res1.todayLogs.m1.takenAt, '08:05');
  assert.equal(res1.todayLogs.m1.ts, now.getTime());

  const state = data.getAppState(now);
  assert.equal(state.todayKey, '2026-11-23');
  assert.equal(state.todayLogs.m1.takenAt, '08:05');

  const res2 = data.toggleMedDose('m1', '2026-11-23', now);
  assert.equal(res2.todayLogs.m1, undefined);
});

test('seedExampleData populates slots and example meds without throwing', () => {
  installMockProps();
  const counts = data.seedExampleData();
  assert.equal(counts.slots, 6);
  assert.equal(counts.meds, 10);

  const state = data.getAppState(new Date(2026, 10, 23, 9, 0, 0));
  assert.equal(state.slots.length, 6);
  assert.equal(state.meds.length, 10);
});
