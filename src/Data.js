/**
 * Data storage, scheduling, edit history (with Undo), settings, and 90-day cleanup
 * for Parents' Tablet. Uses PropertiesService only; no real health data or emails
 * are stored in this file.
 */

var STORE_KEYS = {
  SLOTS: 'pt_slots_v1',
  MEDS: 'pt_meds_v1',
  LOGS: 'pt_logs_v1',
  HISTORY: 'pt_history_v1',
  CONFIG: 'pt_config_v1',
  ALERTS: 'pt_alert_state_v1',
  TODOS: 'pt_todos_v1',
  NOTES: 'pt_notes_v1',
  WATCHED_VIDEOS: 'pt_watched_videos_v1'
};

var RETENTION_DAYS = 90;

function getDefaultConfig_() {
  return {
    alertEmail: '',
    smsGatewayEmail: '',
    katieEmail: '',
    meetUrlTom: '',
    meetUrlKatie: '',
    meetUrlMatt: '',
    meetUrlLaura: '',
    meetContacts: [],
    driveFolderId: '',
    videoFolderId: '',
    doctorName: 'Doctor',
    doctorPhone: '',
    quietStart: '21:00',
    quietEnd: '08:00',
    missedDelayMin: 120,
    soundType: 'chime',
    soundRepeat: 1,
    alarmBanner: 'yes',
    snoozeMin: 10,
    dailySummaryTime: '21:00',
    theme: 'light',
    medFormat: 'qty_first',
    photoCycleSec: 6
  };
}

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

function clone_(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatDateKey_(date) {
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatTimeHHMM_(date) {
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
  }
  var h = String(date.getHours()).padStart(2, '0');
  var min = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + min;
}

function makeId_(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
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

function getConfig_(props) {
  var saved = readJson_(props, STORE_KEYS.CONFIG, {});
  var defaults = getDefaultConfig_();
  var out = {};
  Object.keys(defaults).forEach(function (k) {
    out[k] = (saved[k] !== undefined && saved[k] !== null) ? saved[k] : defaults[k];
  });
  return out;
}

var LOG_KEY_PREFIX = 'pt_log_';
var ALERT_KEY_PREFIX = 'pt_alert_';
var HIST_KEY_PREFIX = 'pt_hist_';
var MAX_HISTORY_ENTRIES = 25;

function readDayLogs_(props, dateKey) {
  var raw = props.getProperty(LOG_KEY_PREFIX + dateKey);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  var legacy = readJson_(props, STORE_KEYS.LOGS, {});
  return (legacy && legacy[dateKey]) ? legacy[dateKey] : {};
}

function writeDayLogs_(props, dateKey, dayLogs) {
  writeJson_(props, LOG_KEY_PREFIX + dateKey, dayLogs || {});
}

function readDayAlertState_(props, dateKey) {
  var raw = props.getProperty(ALERT_KEY_PREFIX + dateKey);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  var legacy = readJson_(props, STORE_KEYS.ALERTS, {});
  return (legacy && legacy[dateKey]) ? legacy[dateKey] : { missedSent: {}, summarySent: false };
}

function writeDayAlertState_(props, dateKey, dayAlerts) {
  writeJson_(props, ALERT_KEY_PREFIX + dateKey, dayAlerts || { missedSent: {}, summarySent: false });
}

function deletePropSafe_(props, key) {
  try {
    if (typeof props.deleteProperty === 'function') props.deleteProperty(key);
    else props.setProperty(key, '');
  } catch (e) {}
}

function saveConfig(configInput, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var cur = getConfig_(props);
    var allowed = Object.keys(getDefaultConfig_());
    allowed.forEach(function (k) {
      if (configInput && configInput[k] !== undefined) {
        cur[k] = configInput[k];
      }
    });
    cur.missedDelayMin = Math.max(15, parseInt(cur.missedDelayMin, 10) || 120);
    var parsedRepeat = parseInt(cur.soundRepeat, 10);
    cur.soundRepeat = isNaN(parsedRepeat) ? 1 : Math.max(0, Math.min(5, parsedRepeat));
    cur.snoozeMin = Math.max(1, Math.min(60, parseInt(cur.snoozeMin, 10) || 10));
    cur.photoCycleSec = Math.max(2, Math.min(120, parseInt(cur.photoCycleSec, 10) || 6));
    if (!cur.dailySummaryTime || String(cur.dailySummaryTime).indexOf(':') === -1) {
      cur.dailySummaryTime = '21:00';
    }
    writeJson_(props, STORE_KEYS.CONFIG, cur);
    return cur;
  });
}

/**
 * Removes logs, alert flags, and history entries older than RETENTION_DAYS (90 days).
 */
function pruneOldData(nowOpt) {
  var props = getProps_();
  var now = nowOpt || new Date();
  var cutoffMs = now.getTime() - RETENTION_DAYS * 86400000;
  var cutoffKey = formatDateKey_(new Date(cutoffMs));

  var allLogs = readJson_(props, STORE_KEYS.LOGS, {});
  var logsChanged = false;
  Object.keys(allLogs).forEach(function (k) {
    if (k < cutoffKey) {
      delete allLogs[k];
      logsChanged = true;
    }
  });
  if (logsChanged) {
    if (Object.keys(allLogs).length) writeJson_(props, STORE_KEYS.LOGS, allLogs);
    else deletePropSafe_(props, STORE_KEYS.LOGS);
  }

  var alerts = readJson_(props, STORE_KEYS.ALERTS, {});
  var alertsChanged = false;
  Object.keys(alerts).forEach(function (k) {
    if (k < cutoffKey) {
      delete alerts[k];
      alertsChanged = true;
    }
  });
  if (alertsChanged) {
    if (Object.keys(alerts).length) writeJson_(props, STORE_KEYS.ALERTS, alerts);
    else deletePropSafe_(props, STORE_KEYS.ALERTS);
  }

  var history = readJson_(props, STORE_KEYS.HISTORY, []);
  var keepIds = {};
  var filtered = [];
  history.forEach(function (h) {
    if ((h.ts || 0) >= cutoffMs) {
      keepIds[h.id] = true;
      if (h.prevSlots || h.prevMeds) {
        writeJson_(props, HIST_KEY_PREFIX + h.id, { prevSlots: h.prevSlots, prevMeds: h.prevMeds });
      }
      filtered.push({
        id: h.id,
        ts: h.ts,
        dateKey: h.dateKey,
        timeStr: h.timeStr,
        summary: h.summary,
        undone: !!h.undone
      });
    } else if (h && h.id) {
      deletePropSafe_(props, HIST_KEY_PREFIX + h.id);
    }
  });
  if (filtered.length !== history.length) {
    writeJson_(props, STORE_KEYS.HISTORY, filtered);
  }

  if (typeof props.getProperties === 'function') {
    var allProps = props.getProperties() || {};
    Object.keys(allProps).forEach(function (k) {
      if (k.indexOf(LOG_KEY_PREFIX) === 0) {
        var dk = k.slice(LOG_KEY_PREFIX.length);
        if (dk < cutoffKey) deletePropSafe_(props, k);
      } else if (k.indexOf(ALERT_KEY_PREFIX) === 0) {
        var ak = k.slice(ALERT_KEY_PREFIX.length);
        if (ak < cutoffKey) deletePropSafe_(props, k);
      } else if (k.indexOf(HIST_KEY_PREFIX) === 0) {
        var hid = k.slice(HIST_KEY_PREFIX.length);
        if (!keepIds[hid]) deletePropSafe_(props, k);
      }
    });
  }
  return { cutoffKey: cutoffKey };
}

function recordHistoryAndNotify_(props, summary, prevSlots, prevMeds, nowOpt) {
  var now = nowOpt || new Date();
  var cutoffMs = now.getTime() - RETENTION_DAYS * 86400000;
  var rawHistory = readJson_(props, STORE_KEYS.HISTORY, []);
  var history = [];
  rawHistory.forEach(function (h) {
    if ((h.ts || 0) < cutoffMs) {
      if (h && h.id) deletePropSafe_(props, HIST_KEY_PREFIX + h.id);
      return;
    }
    if (h.prevSlots || h.prevMeds) {
      writeJson_(props, HIST_KEY_PREFIX + h.id, { prevSlots: h.prevSlots, prevMeds: h.prevMeds });
    }
    history.push({
      id: h.id,
      ts: h.ts,
      dateKey: h.dateKey,
      timeStr: h.timeStr,
      summary: h.summary,
      undone: !!h.undone
    });
  });

  var newId = makeId_('h');
  writeJson_(props, HIST_KEY_PREFIX + newId, {
    prevSlots: clone_(prevSlots),
    prevMeds: clone_(prevMeds)
  });

  history.unshift({
    id: newId,
    ts: now.getTime(),
    dateKey: formatDateKey_(now),
    timeStr: formatTimeHHMM_(now),
    summary: summary,
    undone: false
  });

  if (history.length > MAX_HISTORY_ENTRIES) {
    var dropped = history.slice(MAX_HISTORY_ENTRIES);
    dropped.forEach(function (d) {
      if (d && d.id) deletePropSafe_(props, HIST_KEY_PREFIX + d.id);
    });
    history = history.slice(0, MAX_HISTORY_ENTRIES);
  }
  writeJson_(props, STORE_KEYS.HISTORY, history);

  var cfg = getConfig_(props);
  if (cfg.alertEmail && typeof sendChangeEmail_ === 'function') {
    sendChangeEmail_(cfg, summary);
  }
  return history;
}

/**
 * Loads current slots, meds, today's tick-off logs, settings, and recent history.
 */
function getAppState(nowOpt) {
  var props = getProps_();
  var now = nowOpt || new Date();
  var todayKey = formatDateKey_(now);

  var slots = readJson_(props, STORE_KEYS.SLOTS, []);
  var meds = readJson_(props, STORE_KEYS.MEDS, []);
  var todayLogs = readDayLogs_(props, todayKey);
  var history = readJson_(props, STORE_KEYS.HISTORY, []).map(function (h) {
    return {
      id: h.id,
      dateKey: h.dateKey,
      timeStr: h.timeStr,
      summary: h.summary,
      undone: !!h.undone
    };
  });

  return {
    slots: slots,
    meds: meds,
    todayLogs: todayLogs,
    todayKey: todayKey,
    serverNowMs: now.getTime(),
    config: getConfig_(props),
    history: history,
    todos: readJson_(props, STORE_KEYS.TODOS, []),
    notes: readJson_(props, STORE_KEYS.NOTES, [])
  };
}

function withLock_(fn) {
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(10000);
  try {
    return fn();
  } finally {
    if (lock) lock.releaseLock();
  }
}

function toggleMedDose(medId, dateKeyOpt, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var dateKey = dateKeyOpt || formatDateKey_(now);
    var dayLogs = readDayLogs_(props, dateKey);

    if (dayLogs[medId]) {
      delete dayLogs[medId];
    } else {
      dayLogs[medId] = {
        takenAt: formatTimeHHMM_(now),
        ts: now.getTime()
      };
    }

    writeDayLogs_(props, dateKey, dayLogs);

    return {
      todayKey: dateKey,
      todayLogs: dayLogs,
      serverNowMs: now.getTime()
    };
  });
}

function clearPersonLogs(person, dateKeyOpt, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var dateKey = dateKeyOpt || formatDateKey_(now);
    var meds = readJson_(props, STORE_KEYS.MEDS, []);
    var dayLogs = readDayLogs_(props, dateKey);

    var personMedIds = {};
    meds.forEach(function (m) {
      if (m.person === person) personMedIds[m.id] = true;
    });
    Object.keys(dayLogs).forEach(function (mid) {
      if (personMedIds[mid]) delete dayLogs[mid];
    });

    writeDayLogs_(props, dateKey, dayLogs);

    return {
      todayKey: dateKey,
      todayLogs: dayLogs,
      serverNowMs: now.getTime()
    };
  });
}

function saveMed(medInput, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var slots = readJson_(props, STORE_KEYS.SLOTS, []);
    var meds = readJson_(props, STORE_KEYS.MEDS, []);
    var prevMeds = clone_(meds);

    var clean = {
      id: medInput.id || makeId_('m'),
      person: medInput.person === 'peggy' ? 'peggy' : 'gene',
      slotId: medInput.freq === 'prn' ? '' : (medInput.slotId || ''),
      name: String(medInput.name || '').trim(),
      strength: String(medInput.strength || '').trim(),
      dose: String(medInput.dose || '').trim(),
      note: String(medInput.note || '').trim(),
      warning: String(medInput.warning || '').trim(),
      freq: medInput.freq || 'daily',
      days: Array.isArray(medInput.days) ? medInput.days.map(Number) : []
    };
    if (!clean.name) throw new Error('Medication name is required.');

    var idx = meds.findIndex(function (m) { return m.id === clean.id; });
    var verb = idx >= 0 ? 'Edited' : 'Added';
    if (idx >= 0) {
      meds[idx] = clean;
    } else {
      meds.push(clean);
    }

    writeJson_(props, STORE_KEYS.MEDS, meds);
    var who = clean.person === 'peggy' ? 'Peggy' : 'Gene';
    recordHistoryAndNotify_(props, verb + ' ' + who + ': ' + clean.name, slots, prevMeds, now);
    return getAppState(now);
  });
}

function deleteMed(medId, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var slots = readJson_(props, STORE_KEYS.SLOTS, []);
    var meds = readJson_(props, STORE_KEYS.MEDS, []);
    var prevMeds = clone_(meds);

    var target = meds.find(function (m) { return m.id === medId; });
    if (!target) return getAppState(now);

    meds = meds.filter(function (m) { return m.id !== medId; });
    writeJson_(props, STORE_KEYS.MEDS, meds);

    var who = target.person === 'peggy' ? 'Peggy' : 'Gene';
    recordHistoryAndNotify_(props, 'Deleted ' + who + ': ' + target.name, slots, prevMeds, now);
    return getAppState(now);
  });
}

function saveSlot(slotInput, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var slots = readJson_(props, STORE_KEYS.SLOTS, []);
    var meds = readJson_(props, STORE_KEYS.MEDS, []);
    var prevSlots = clone_(slots);

    var idx = slots.findIndex(function (s) { return s.id === slotInput.id; });
    if (idx < 0) throw new Error('Slot not found.');

    var updated = clone_(slots[idx]);
    if (slotInput.time) updated.time = String(slotInput.time).trim();
    if (slotInput.name) updated.name = String(slotInput.name).trim();
    if (slotInput.note !== undefined) updated.note = String(slotInput.note || '').trim();
    if (slotInput.waitMinutes !== undefined) {
      var wm = parseInt(slotInput.waitMinutes, 10);
      if (wm > 0) updated.waitMinutes = wm;
      else delete updated.waitMinutes;
    }

    slots[idx] = updated;
    writeJson_(props, STORE_KEYS.SLOTS, slots);

    var who = updated.person === 'peggy' ? 'Peggy' : 'Gene';
    recordHistoryAndNotify_(props, 'Updated ' + who + ' slot ' + updated.name + ' to ' + updated.time, prevSlots, meds, now);
    return getAppState(now);
  });
}

function undoHistory(historyId, nowOpt) {
  return withLock_(function () {
    var props = getProps_();
    var now = nowOpt || new Date();
    var history = readJson_(props, STORE_KEYS.HISTORY, []);
    var entry = history.find(function (h) { return h.id === historyId; });
    if (!entry || entry.undone) return getAppState(now);

    var curSlots = readJson_(props, STORE_KEYS.SLOTS, []);
    var curMeds = readJson_(props, STORE_KEYS.MEDS, []);
    var snap = readJson_(props, HIST_KEY_PREFIX + historyId, null);
    var restoreSlots = (snap && snap.prevSlots) ? snap.prevSlots : (entry.prevSlots || curSlots);
    var restoreMeds = (snap && snap.prevMeds) ? snap.prevMeds : (entry.prevMeds || curMeds);

    writeJson_(props, STORE_KEYS.SLOTS, restoreSlots);
    writeJson_(props, STORE_KEYS.MEDS, restoreMeds);

    entry.undone = true;
    writeJson_(props, STORE_KEYS.HISTORY, history);

    recordHistoryAndNotify_(props, 'Undid: ' + entry.summary, curSlots, curMeds, now);
    return getAppState(now);
  });
}

/**
 * Seeds purely fictional example data for testing without exposing real health data.
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

function saveTodos(todos) {
  return withLock_(function () {
    var props = getProps_();
    var clean = Array.isArray(todos) ? todos : [];
    writeJson_(props, STORE_KEYS.TODOS, clean);
    return clean;
  });
}

function saveNotes(notes) {
  return withLock_(function () {
    var props = getProps_();
    var clean = Array.isArray(notes) ? notes : [];
    writeJson_(props, STORE_KEYS.NOTES, clean);
    return clean;
  });
}

function markVideoWatched(videoId) {
  return withLock_(function () {
    var props = getProps_();
    var watched = readJson_(props, STORE_KEYS.WATCHED_VIDEOS, []);
    if (videoId && watched.indexOf(videoId) === -1) {
      watched.push(videoId);
      if (watched.length > 100) watched = watched.slice(-100);
      writeJson_(props, STORE_KEYS.WATCHED_VIDEOS, watched);
    }
    return watched;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORE_KEYS: STORE_KEYS,
    RETENTION_DAYS: RETENTION_DAYS,
    getDefaultConfig_: getDefaultConfig_,
    isMedScheduledForDate: isMedScheduledForDate,
    getAppState: getAppState,
    toggleMedDose: toggleMedDose,
    clearPersonLogs: clearPersonLogs,
    saveMed: saveMed,
    deleteMed: deleteMed,
    saveSlot: saveSlot,
    undoHistory: undoHistory,
    saveConfig: saveConfig,
    saveTodos: saveTodos,
    saveNotes: saveNotes,
    markVideoWatched: markVideoWatched,
    pruneOldData: pruneOldData,
    seedExampleData: seedExampleData,
    formatDateKey_: formatDateKey_,
    formatTimeHHMM_: formatTimeHHMM_,
    getProps_: getProps_,
    getConfig_: getConfig_,
    readJson_: readJson_,
    writeJson_: writeJson_,
    readDayLogs_: readDayLogs_,
    writeDayLogs_: writeDayLogs_,
    readDayAlertState_: readDayAlertState_,
    writeDayAlertState_: writeDayAlertState_,
    LOG_KEY_PREFIX: LOG_KEY_PREFIX,
    ALERT_KEY_PREFIX: ALERT_KEY_PREFIX,
    HIST_KEY_PREFIX: HIST_KEY_PREFIX
  };
}
