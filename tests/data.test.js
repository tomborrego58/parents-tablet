const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../src/Data.js');
const alerts = require('../src/AlertsAndPhotos.js');

// Expose Data.js helpers globally so AlertsAndPhotos.js can call them just like Apps Script global scope
Object.assign(global, data);

function installMockServices(initial = {}) {
  const store = { ...initial };
  const sentEmails = [];
  global.PropertiesService = {
    getScriptProperties() {
      return {
        getProperty(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setProperty(k, v) {
          const s = String(v);
          if (s.length > 9216) throw new Error('Property value is too large: ' + k + ' (' + s.length + ' bytes)');
          store[k] = s;
        },
        deleteProperty(k) { delete store[k]; },
        getProperties() { return { ...store }; }
      };
    }
  };
  global.LockService = {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  };
  global.MailApp = {
    sendEmail(opts) { sentEmails.push(opts); }
  };
  return { store, sentEmails };
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
  installMockServices();
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

test('saveMed, saveSlot, deleteMed, and undoHistory work with history & notifications', () => {
  installMockServices();
  data.seedExampleData();
  const now = new Date(2026, 10, 23, 10, 0, 0);

  const s1 = data.saveMed({
    person: 'peggy',
    slotId: 'p-am',
    name: 'Example New Med',
    strength: '10 mg',
    dose: '1 tablet',
    freq: 'daily'
  }, now);
  assert.equal(s1.meds.length, 11);
  assert.equal(s1.history.length, 1);
  assert.match(s1.history[0].summary, /Added Peggy: Example New Med/);

  const s2 = data.saveSlot({ id: 'p-am', time: '08:30' }, now);
  const pAm = s2.slots.find((s) => s.id === 'p-am');
  assert.equal(pAm.time, '08:30');

  const added = s1.meds.find((m) => m.name === 'Example New Med');
  const s3 = data.deleteMed(added.id, now);
  assert.equal(s3.meds.length, 10);

  // Undo the delete
  const delHistId = s3.history[0].id;
  const s4 = data.undoHistory(delHistId, now);
  assert.equal(s4.meds.length, 11);
});

test('pruneOldData removes logs, alerts, and history older than 90 days', () => {
  const { store } = installMockServices();
  const now = new Date(2026, 10, 23, 12, 0, 0);
  store[data.STORE_KEYS.LOGS] = JSON.stringify({
    '2026-01-01': { m1: { takenAt: '08:00', ts: 1 } },
    '2026-11-22': { m1: { takenAt: '08:00', ts: 2 } }
  });
  store[data.STORE_KEYS.HISTORY] = JSON.stringify([
    { id: 'old', ts: new Date(2026, 0, 1).getTime(), summary: 'old' },
    { id: 'new', ts: new Date(2026, 10, 22).getTime(), summary: 'new' }
  ]);

  data.pruneOldData(now);
  const logs = JSON.parse(store[data.STORE_KEYS.LOGS]);
  const hist = JSON.parse(store[data.STORE_KEYS.HISTORY]);
  assert.equal(logs['2026-01-01'], undefined);
  assert.ok(logs['2026-11-22']);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].id, 'new');
});

test('quiet hours, Drive folder ID extraction, missed-dose (2h) & 9pm summary work', () => {
  const { sentEmails } = installMockServices();
  data.seedExampleData();
  data.saveConfig({ alertEmail: 'test@example.com', quietStart: '21:00', quietEnd: '08:00', missedDelayMin: 120, dailySummaryTime: '21:00', soundType: 'none', meetUrlMatt: 'https://meet.google.com/aaa', meetUrlLaura: 'https://meet.google.com/bbb' });

  // Test clearPersonLogs clears only that person's logs
  data.toggleMedDose('m1', '2026-11-23', new Date(2026, 10, 23, 7, 5, 0)); // gene
  data.toggleMedDose('m6', '2026-11-23', new Date(2026, 10, 23, 8, 5, 0)); // peggy
  const afterClear = data.clearPersonLogs('gene', '2026-11-23', new Date(2026, 10, 23, 8, 6, 0));
  assert.equal(afterClear.todayLogs.m1, undefined);
  assert.ok(afterClear.todayLogs.m6);
  // Reset for missed-dose check
  data.clearPersonLogs('peggy', '2026-11-23', new Date(2026, 10, 23, 8, 7, 0));

  assert.equal(alerts.isInQuietHours_(new Date(2026, 10, 23, 22, 0, 0), '21:00', '08:00'), true);
  assert.equal(alerts.isInQuietHours_(new Date(2026, 10, 23, 7, 30, 0), '21:00', '08:00'), true);
  assert.equal(alerts.isInQuietHours_(new Date(2026, 10, 23, 10, 30, 0), '21:00', '08:00'), false);
  assert.equal(alerts.extractDriveFolderId_('https://drive.google.com/drive/folders/1AbC_xyz-99?usp=sharing'), '1AbC_xyz-99');

  // At 10:30 am, 08:00 Morning slot is 2.5h overdue -> sends missed-dose emails (no duplicates on second run)
  alerts.runScheduledChecks(new Date(2026, 10, 23, 10, 30, 0));
  const missedCount = sentEmails.length;
  assert.ok(missedCount >= 1);
  alerts.runScheduledChecks(new Date(2026, 10, 23, 10, 45, 0));
  assert.equal(sentEmails.length, missedCount);

  // At 9:05 pm (inside quiet hours, >= dailySummaryHour 21) -> sends 1 daily summary email
  alerts.runScheduledChecks(new Date(2026, 10, 23, 21, 5, 0));
  assert.equal(sentEmails.length, missedCount + 1);
  assert.match(sentEmails[sentEmails.length - 1].subject, /Daily Summary/);
});

test('saveTodos, saveNotes, and markVideoWatched persist in PropertiesService', () => {
  installMockServices();
  data.saveTodos([{ text: 'Tue, Dec 1 · NLT 10:00 — Mail gifts (Gene)', done: false }]);
  data.saveNotes([{ text: 'Call pharmacy', date: 'Nov 24' }]);
  const watched = data.markVideoWatched('vid_123');
  assert.deepEqual(watched, ['vid_123']);

  const st = data.getAppState(new Date(2026, 10, 24, 12, 0, 0));
  assert.equal(st.todos.length, 1);
  assert.equal(st.notes.length, 1);
});

test('Code.js dispatchApi_ routes whitelisted actions and rejects unknown actions', () => {
  installMockServices();
  const code = require('../src/Code.js');
  const st = code.dispatchApi_('apiGetState', []);
  assert.ok(Array.isArray(st.meds));
  assert.throws(() => code.dispatchApi_('unknownAction', []), /Unknown action/);
});

test('sharded logs, alerts, and history stay under 9KB limit and prune cleanly', () => {
  const { store } = installMockServices();
  data.seedExampleData();
  const base = new Date(2026, 7, 1, 9, 0, 0); // Aug 1, 2026

  // Simulate 100 days of logs across 10 meds
  for (let d = 0; d < 100; d++) {
    const dt = new Date(base.getTime() + d * 86400000);
    const dk = data.formatDateKey_(dt);
    for (let m = 1; m <= 10; m++) {
      data.toggleMedDose('m' + m, dk, dt);
    }
  }

  // Simulate 30 med edits (would have crashed 9KB limit before sharding)
  for (let i = 0; i < 30; i++) {
    data.saveSlot({ id: 'p-am', time: i % 2 === 0 ? '08:05' : '08:10' }, new Date(base.getTime() + 99 * 86400000));
  }

  // Every property key must be < 9KB
  Object.keys(store).forEach((k) => {
    assert.ok(store[k].length < 9216, `Key ${k} exceeded 9KB (${store[k].length})`);
  });

  // Prune 100 days later -> old sharded log keys removed
  const pruneNow = new Date(base.getTime() + 100 * 86400000);
  data.pruneOldData(pruneNow);
  assert.equal(store[data.LOG_KEY_PREFIX + '2026-08-01'], undefined);
  assert.ok(store[data.LOG_KEY_PREFIX + data.formatDateKey_(new Date(base.getTime() + 99 * 86400000))]);
});

test('saveConfig preserves soundRepeat=0 and photoCycleSec', () => {
  installMockServices();
  const cfg = data.saveConfig({ soundRepeat: 0, photoCycleSec: 8 });
  assert.equal(cfg.soundRepeat, 0);
  assert.equal(cfg.photoCycleSec, 8);
});

test('clean deploy initializes default slots, validates weekly days, honors client dateKey, and caps todos <8KB', () => {
  const { store } = installMockServices();
  // Clean deploy has default slots automatically
  const st0 = data.getAppState('2026-11-28');
  assert.equal(st0.todayKey, '2026-11-28');
  assert.ok(st0.slots.length >= 6);

  // Weekly med with empty days throws
  assert.throws(() => data.saveMed({
    person: 'gene',
    name: 'Weekly Test',
    freq: 'weekly',
    days: []
  }), /at least one day/);

  // Weekly med with multiple days trims to 1 day and auto-assigns first slot
  const st1 = data.saveMed({
    person: 'gene',
    name: 'Weekly Test',
    freq: 'weekly',
    days: [2, 5]
  }, new Date(2026, 10, 28, 9, 0, 0));
  const savedMed = st1.meds.find((m) => m.name === 'Weekly Test');
  assert.deepEqual(savedMed.days, [2]);
  assert.ok(savedMed.slotId);

  // 120 todos capped safely under 9KB
  const bigTodos = [];
  for (let i = 0; i < 120; i++) {
    bigTodos.push({
      desc: 'Long task description item number ' + i + ' with extra text to test 9KB guard',
      dateISO: '2026-11-28',
      timeStr: '10:00 a',
      who: 'Both',
      from: 'Tom',
      done: i % 2 === 0
    });
  }
  const capped = data.saveTodos(bigTodos);
  assert.ok(capped.length < 120);
  assert.ok(store[data.STORE_KEYS.TODOS].length <= 8000);
});
