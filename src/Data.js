/**
 * Data storage and scheduling logic for Parents' Tablet.
 * Uses PropertiesService (script properties) so all data stays in the tablet's Google account.
 * No real medication lists are stored in this file.
 */

var STORE_KEYS = {
  SLOTS: 'pt_slots_v1',
  MEDS: 'pt_meds_v1',
  LOGS: 'pt_logs_v1'
};

/**
 * Returns storage backend (Apps Script PropertiesService, or overridable for tests).
 */
function getProps_() {
  return PropertiesService.getScriptProperties();
}

function readJson_(props, key, fallback) {
  var raw = props.getProperty(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson_(props, key, value) {
  props.setProperty(key, JSON.stringify(value));
}

/**
 * Formats a Date into YYYY-MM-DD in script timezone (or local time in tests).
 */
function formatDateKey_(date) {
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/**
 * Formats a Date into HH:MM (24h) in script timezone (or local time in tests).
 */
function formatTimeHHMM_(date) {
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
  }
  var h = String(date.getHours()).padStart(2, '0');
  var min = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + min;
}

/**
 * Returns true if a med is scheduled on the given Date.
 * freq: 'daily' | 'weekly' | 'days' | 'prn'
 * days: array of weekday ints (0=Sun .. 6=Sat)
 */
function isMedScheduledForDate(med, date) {
  if (!med || !med.freq) return false;
  if (med.freq === 'daily') return true;
  if (med.freq === 'prn') return true;
  if (med.freq === 'weekly' || med.freq === 'days') {
    var dow = date.getDay();
    var days = Array.isArray(med.days) ? med.days : [];
    return days.indexOf(dow) !== -1;
  }
  return false;
}

/**
 * Loads current slots, meds, and today's tick-off logs.
 */
function getAppState(nowOpt) {
  var props = getProps_();
  var now = nowOpt || new Date();
  var todayKey = formatDateKey_(now);

  var slots = readJson_(props, STORE_KEYS.SLOTS, []);
  var meds = readJson_(props, STORE_KEYS.MEDS, []);
  var allLogs = readJson_(props, STORE_KEYS.LOGS, {});
  var todayLogs = allLogs[todayKey] || {};

  return {
    slots: slots,
    meds: meds,
    todayLogs: todayLogs,
    todayKey: todayKey,
    serverNowMs: now.getTime()
  };
}

/**
 * Toggles a medication dose for a given dateKey (defaults to today).
 * Uses LockService when available to prevent concurrent tap races.
 */
function toggleMedDose(medId, dateKeyOpt, nowOpt) {
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(10000);

  try {
    var props = getProps_();
    var now = nowOpt || new Date();
    var dateKey = dateKeyOpt || formatDateKey_(now);
    var allLogs = readJson_(props, STORE_KEYS.LOGS, {});
    var dayLogs = allLogs[dateKey] || {};

    if (dayLogs[medId]) {
      delete dayLogs[medId];
    } else {
      dayLogs[medId] = {
        takenAt: formatTimeHHMM_(now),
        ts: now.getTime()
      };
    }

    allLogs[dateKey] = dayLogs;
    writeJson_(props, STORE_KEYS.LOGS, allLogs);

    return {
      todayKey: dateKey,
      todayLogs: dayLogs,
      serverNowMs: now.getTime()
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * Seeds purely fictional example data for testing step 2b before Edit Meds (2c) is built.
 * Safe to run from the Apps Script editor; uses no real medication names.
 */
function seedExampleData() {
  var props = getProps_();
  var slots = [
    { id: 'g-wake', person: 'gene', name: 'Wake up', time: '07:00', waitMinutes: 120 },
    { id: 'g-am', person: 'gene', name: 'Morning', time: '08:00' },
    { id: 'g-din', person: 'gene', name: 'With dinner', time: '18:00' },
    { id: 'g-bed', person: 'gene', name: 'Bedtime', time: '20:30' },
    { id: 'p-am', person: 'peggy', name: 'Morning', time: '08:00' },
    { id: 'p-bed', person: 'peggy', name: 'Bedtime', time: '21:00' }
  ];
  var meds = [
    { id: 'm1', person: 'gene', slotId: 'g-wake', name: 'Example med W', strength: '50 mcg', dose: '1 tablet', note: 'empty stomach', freq: 'daily' },
    { id: 'm2', person: 'gene', slotId: 'g-am', name: 'Example med A', strength: '20 mg', dose: '1 capsule', note: 'after food', freq: 'daily' },
    { id: 'm3', person: 'gene', slotId: 'g-am', name: 'Example med B', strength: '25 mg', dose: '3 tablets = 75 mg', warning: 'Example handling warning: wash hands after touching', freq: 'daily' },
    { id: 'm4', person: 'gene', slotId: 'g-din', name: 'Example med C', strength: '10 mg', dose: '1 tablet', freq: 'daily' },
    { id: 'm5', person: 'gene', slotId: 'g-bed', name: 'Example weekly shot', strength: '1 dose', dose: '1 pen', note: 'Saturday only', freq: 'weekly', days: [6] },
    { id: 'm6', person: 'peggy', slotId: 'p-am', name: 'Example med P1', strength: '25 mg', dose: '1 tablet', warning: 'Check HR + BP before taking; hold for HR < 60 BPM', freq: 'daily' },
    { id: 'm7', person: 'peggy', slotId: 'p-am', name: 'Example med P2', strength: '40 mg', dose: '1 tablet', note: 'before meals · do not crush', freq: 'daily' },
    { id: 'm8', person: 'peggy', slotId: 'p-bed', name: 'Example med P3', strength: '10 mg', dose: '1 tablet', freq: 'daily' },
    { id: 'm9', person: 'peggy', slotId: 'p-bed', name: 'Example 2x/week med', strength: '10 mcg', dose: '1 tablet', note: 'Mon & Thu', freq: 'days', days: [1, 4] },
    { id: 'm10', person: 'peggy', slotId: '', name: 'Example inhaler', strength: '90 mcg', dose: '2 puffs', note: 'every 4 hours if needed', freq: 'prn' }
  ];
  writeJson_(props, STORE_KEYS.SLOTS, slots);
  writeJson_(props, STORE_KEYS.MEDS, meds);
  return { slots: slots.length, meds: meds.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORE_KEYS: STORE_KEYS,
    isMedScheduledForDate: isMedScheduledForDate,
    getAppState: getAppState,
    toggleMedDose: toggleMedDose,
    seedExampleData: seedExampleData,
    formatDateKey_: formatDateKey_,
    formatTimeHHMM_: formatTimeHHMM_
  };
}
