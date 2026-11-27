/**
 * Alerts (change emails, missed-dose checks, 9pm daily summary),
 * Google Drive photo slideshow + email-to-Drive import, and Call notifications.
 */

function sendMailSafe_(to, subject, body) {
  if (!to || typeof MailApp === 'undefined') return false;
  MailApp.sendEmail({ to: to, subject: subject, body: body });
  return true;
}

function sendChangeEmail_(cfg, summary) {
  if (!cfg || !cfg.alertEmail) return;
  var body = summary + '\n\nOpen Parents\' Tablet to review or undo.';
  sendMailSafe_(cfg.alertEmail, "Parents' Tablet: " + summary, body);
  if (cfg.smsGatewayEmail) {
    sendMailSafe_(cfg.smsGatewayEmail, "Parents' Tablet", summary);
  }
}

function parseHHMMToMinutes_(hhmm, fallbackMin) {
  if (!hhmm || hhmm.indexOf(':') === -1) return fallbackMin;
  var p = hhmm.split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

function isInQuietHours_(now, quietStart, quietEnd) {
  var curMin = now.getHours() * 60 + now.getMinutes();
  var startMin = parseHHMMToMinutes_(quietStart, 21 * 60);
  var endMin = parseHHMMToMinutes_(quietEnd, 8 * 60);
  if (startMin === endMin) return false;
  if (startMin > endMin) {
    return curMin >= startMin || curMin < endMin;
  }
  return curMin >= startMin && curMin < endMin;
}

function parseTodayTimeMs_(now, hhmm) {
  var p = (hhmm || '00:00').split(':');
  return new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, 0, 0
  ).getTime();
}

function buildDailySummaryText_(dateKey, slots, meds, dayLogs, now) {
  var lines = ["Parents' Tablet — Daily Summary for " + dateKey, ''];
  ['gene', 'peggy'].forEach(function (person) {
    var label = person === 'gene' ? 'GENE' : 'PEGGY';
    lines.push(label + ':');
    var pSlots = slots.filter(function (s) { return s.person === person; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });

    pSlots.forEach(function (slot) {
      var sMeds = meds.filter(function (m) {
        return m.person === person && m.slotId === slot.id && m.freq !== 'prn' && isMedScheduledForDate(m, now);
      });
      if (!sMeds.length) return;
      lines.push('  ' + slot.name + ' (' + slot.time + '):');
      sMeds.forEach(function (m) {
        var log = dayLogs[m.id];
        var status = log ? ('✓ taken at ' + log.takenAt) : '✗ NOT TICKED';
        lines.push('    - ' + m.name + (m.strength ? ' ' + m.strength : '') + ': ' + status);
      });
    });

    var prns = meds.filter(function (m) { return m.person === person && m.freq === 'prn'; });
    prns.forEach(function (m) {
      var log = dayLogs[m.id];
      if (log) {
        lines.push('  As Needed: ' + m.name + ' used at ' + log.takenAt);
      }
    });
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Time-driven check (every 15 min): prunes 90-day old data, sends missed-dose alerts
 * (outside quiet hours), and sends the daily summary email at dailySummaryHour (9pm).
 */
function runScheduledChecks(nowOpt) {
  var now = nowOpt || new Date();
  pruneOldData(now);

  var props = getProps_();
  var cfg = getConfig_(props);
  var todayKey = formatDateKey_(now);
  var slots = readJson_(props, STORE_KEYS.SLOTS, []);
  var meds = readJson_(props, STORE_KEYS.MEDS, []);
  var allLogs = readJson_(props, STORE_KEYS.LOGS, {});
  var dayLogs = allLogs[todayKey] || {};
  var allAlerts = readJson_(props, STORE_KEYS.ALERTS, {});
  var dayAlerts = allAlerts[todayKey] || { missedSent: {}, summarySent: false };
  var nowMs = now.getTime();
  var changed = false;

  // 1. Missed-dose alerts (outside quiet hours)
  if (cfg.alertEmail && !isInQuietHours_(now, cfg.quietStart, cfg.quietEnd)) {
    ['gene', 'peggy'].forEach(function (person) {
      var pSlots = slots.filter(function (s) { return s.person === person; })
        .sort(function (a, b) { return a.time.localeCompare(b.time); });
      var activeWaitUntil = 0;

      pSlots.forEach(function (slot) {
        var sMeds = meds.filter(function (m) {
          return m.person === person && m.slotId === slot.id && m.freq !== 'prn' && isMedScheduledForDate(m, now);
        });
        if (!sMeds.length) return;

        var allTicked = sMeds.every(function (m) { return !!dayLogs[m.id]; });
        var maxTs = 0;
        sMeds.forEach(function (m) {
          if (dayLogs[m.id] && dayLogs[m.id].ts > maxTs) maxTs = dayLogs[m.id].ts;
        });

        if (allTicked) {
          if (slot.waitMinutes && maxTs > 0) {
            var wu = maxTs + slot.waitMinutes * 60000;
            if (wu > activeWaitUntil) activeWaitUntil = wu;
          }
          return;
        }

        var effMs = Math.max(parseTodayTimeMs_(now, slot.time), activeWaitUntil);
        var missedAtMs = effMs + (cfg.missedDelayMin || 120) * 60000;
        if (nowMs >= missedAtMs && !dayAlerts.missedSent[slot.id]) {
          var who = person === 'gene' ? 'Gene' : 'Peggy';
          var unticked = sMeds.filter(function (m) { return !dayLogs[m.id]; })
            .map(function (m) { return m.name; }).join(', ');
          var subj = "Parents' Tablet: " + who + " hasn't ticked " + slot.name + ' meds';
          var body = who + ' has unticked ' + slot.name + ' meds (' + unticked + ').';
          sendMailSafe_(cfg.alertEmail, subj, body);
          if (cfg.smsGatewayEmail) sendMailSafe_(cfg.smsGatewayEmail, 'Missed Meds', body);
          dayAlerts.missedSent[slot.id] = nowMs;
          changed = true;
        }
      });
    });
  }

  // 2. Daily summary email (default 21:00)
  var summaryTargetMin = cfg.dailySummaryTime
    ? parseHHMMToMinutes_(cfg.dailySummaryTime, 21 * 60)
    : ((cfg.dailySummaryHour !== undefined ? cfg.dailySummaryHour : 21) * 60);
  var nowMin = now.getHours() * 60 + now.getMinutes();
  if (cfg.alertEmail && nowMin >= summaryTargetMin && !dayAlerts.summarySent) {
    var summaryBody = buildDailySummaryText_(todayKey, slots, meds, dayLogs, now);
    sendMailSafe_(cfg.alertEmail, "Parents' Tablet: Daily Summary (" + todayKey + ')', summaryBody);
    dayAlerts.summarySent = true;
    changed = true;
  }

  if (changed) {
    allAlerts[todayKey] = dayAlerts;
    writeJson_(props, STORE_KEYS.ALERTS, allAlerts);
  }
  return dayAlerts;
}

function extractDriveFolderId_(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  var m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s;
}

function getDrivePhotos() {
  var props = getProps_();
  var cfg = getConfig_(props);
  var folderId = extractDriveFolderId_(cfg.driveFolderId);
  if (!folderId || typeof DriveApp === 'undefined') return [];

  try {
    var folder = DriveApp.getFolderById(folderId);
    var out = [];
    var subs = [];
    var subIt = folder.getFolders();
    while (subIt.hasNext()) {
      subs.push(subIt.next());
    }
    subs.sort(function (a, b) {
      return a.getName().localeCompare(b.getName());
    });

    if (subs.length > 0) {
      var perSubCap = Math.max(40, Math.floor(350 / subs.length));
      for (var i = 0; i < subs.length && out.length < 500; i++) {
        var sub = subs[i];
        var albumName = sub.getName();
        var subFiles = sub.getFiles();
        var count = 0;
        while (subFiles.hasNext() && count < perSubCap && out.length < 500) {
          var sf = subFiles.next();
          var smime = sf.getMimeType() || '';
          if (smime.indexOf('image/') === 0) {
            var sid = sf.getId();
            out.push({
              id: sid,
              name: sf.getName(),
              album: albumName,
              url: 'https://lh3.googleusercontent.com/d/' + sid + '=w1600'
            });
            count++;
          }
        }
      }
    }

    var files = folder.getFiles();
    while (files.hasNext() && out.length < 500) {
      var f = files.next();
      var mime = f.getMimeType() || '';
      if (mime.indexOf('image/') === 0) {
        var id = f.getId();
        out.push({
          id: id,
          name: f.getName(),
          album: '',
          url: 'https://lh3.googleusercontent.com/d/' + id + '=w1600'
        });
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

function getPhotoDataUrl(fileId) {
  if (!fileId || typeof Utilities === 'undefined') return '';
  try {
    if (typeof UrlFetchApp !== 'undefined' && typeof ScriptApp !== 'undefined') {
      var resp = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1280', {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() === 200) {
        var tb = resp.getBlob();
        var ct = tb.getContentType() || 'image/jpeg';
        if (ct.indexOf('image/') === 0) {
          return 'data:' + ct + ';base64,' + Utilities.base64Encode(tb.getBytes());
        }
      }
    }
    if (typeof DriveApp !== 'undefined') {
      var blob = DriveApp.getFileById(fileId).getBlob();
      var mime = blob.getContentType() || 'image/jpeg';
      var b64 = Utilities.base64Encode(blob.getBytes());
      if (b64.length < 8000000) {
        return 'data:' + mime + ';base64,' + b64;
      }
    }
  } catch (e) {}
  return '';
}

function getDriveVideos() {
  var props = getProps_();
  var cfg = getConfig_(props);
  var folderId = extractDriveFolderId_(cfg.videoFolderId);
  if (!folderId || typeof DriveApp === 'undefined') return [];

  var watched = readJson_(props, STORE_KEYS.WATCHED_VIDEOS, []);
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var out = [];
    while (files.hasNext() && out.length < 20) {
      var f = files.next();
      var mime = f.getMimeType() || '';
      var id = f.getId();
      if (mime.indexOf('video/') === 0 && watched.indexOf(id) === -1) {
        out.push({
          id: id,
          name: f.getName(),
          previewUrl: 'https://drive.google.com/file/d/' + id + '/preview'
        });
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

function getAvatarMap() {
  var props = getProps_();
  var cfg = getConfig_(props);
  var contacts = Array.isArray(cfg.meetContacts) ? cfg.meetContacts : [];
  var map = {};
  if (typeof DriveApp === 'undefined' || typeof Utilities === 'undefined') return map;

  contacts.forEach(function (c) {
    var raw = c && c.photoUrl ? String(c.photoUrl).trim() : '';
    if (!raw || map[raw]) return;
    var m = raw.match(/\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!m) return;
    try {
      var b64 = '';
      var mime = 'image/jpeg';
      if (typeof UrlFetchApp !== 'undefined') {
        try {
          var thumbResp = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w300', { muteHttpExceptions: true });
          if (thumbResp.getResponseCode() === 200) {
            var tb = thumbResp.getBlob();
            mime = tb.getContentType() || 'image/jpeg';
            b64 = Utilities.base64Encode(tb.getBytes());
          }
        } catch (err) {}
      }
      if (!b64) {
        var file = DriveApp.getFileById(m[1]);
        var blob = file.getBlob();
        mime = blob.getContentType() || 'image/jpeg';
        b64 = Utilities.base64Encode(blob.getBytes());
      }
      if (b64 && b64.length < 600000) {
        map[raw] = 'data:' + mime + ';base64,' + b64;
      }
    } catch (e) {}
  });
  return map;
}

/**
 * Checks unread emails with image attachments and saves them into the Drive photo folder.
 */
function importPhotoEmails() {
  var props = getProps_();
  var cfg = getConfig_(props);
  var folderId = extractDriveFolderId_(cfg.driveFolderId);
  if (!folderId || typeof GmailApp === 'undefined' || typeof DriveApp === 'undefined') return 0;

  var folder = DriveApp.getFolderById(folderId);
  var threads = GmailApp.search('to:me has:attachment is:unread', 0, 20);
  var savedCount = 0;

  threads.forEach(function (thread) {
    var msgs = thread.getMessages();
    msgs.forEach(function (msg) {
      if (!msg.isUnread()) return;
      var atts = msg.getAttachments();
      atts.forEach(function (att) {
        var ct = att.getContentType() || '';
        if (ct.indexOf('image/') === 0) {
          folder.createFile(att.copyBlob());
          savedCount++;
        }
      });
    });
    thread.markRead();
  });
  return savedCount;
}

function notifyCall(who, customUrl) {
  var props = getProps_();
  var cfg = getConfig_(props);
  var key = String(who || 'tom').toLowerCase();
  var name = who ? (who.charAt(0).toUpperCase() + who.slice(1)) : 'Tom';
  var email = '';
  var meetUrl = customUrl || '';

  if (key === 'tom') {
    name = 'Tom';
    email = cfg.alertEmail;
    meetUrl = meetUrl || cfg.meetUrlTom;
  } else if (key === 'katie') {
    name = 'Katie';
    email = cfg.katieEmail;
    meetUrl = meetUrl || cfg.meetUrlKatie;
  } else if (key === 'matt') {
    name = 'Matt';
    meetUrl = meetUrl || cfg.meetUrlMatt;
  } else if (key === 'laura') {
    name = 'Laura';
    meetUrl = meetUrl || cfg.meetUrlLaura;
  }

  if (!meetUrl && Array.isArray(cfg.meetContacts)) {
    var match = cfg.meetContacts.find(function (c) {
      return c.name && c.name.toLowerCase() === key;
    });
    if (match && match.url) meetUrl = match.url;
  }

  var emailed = false;
  if (email) {
    var body = 'Gene & Peggy tapped "Call ' + name + '" on the tablet.' +
      (meetUrl ? '\n\nTap to join Google Meet:\n' + meetUrl : '');
    emailed = sendMailSafe_(email, "Parents' Tablet: Call " + name, body);
    if (key === 'tom' && cfg.smsGatewayEmail) {
      sendMailSafe_(cfg.smsGatewayEmail, 'Tablet Call', 'Parents tapped Call Tom: ' + (meetUrl || 'open Meet'));
    }
  }
  return { ok: true, who: name, meetUrl: meetUrl || '', emailed: emailed };
}

/**
 * Run once from the Apps Script editor to enable 15-minute background checks
 * (missed-dose alerts, 9pm daily summary, 90-day cleanup, and email photo import).
 */
function installTriggers() {
  if (typeof ScriptApp === 'undefined') return;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runScheduledChecks').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('importPhotoEmails').timeBased().everyMinutes(15).create();
  return 'Triggers installed';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isInQuietHours_: isInQuietHours_,
    extractDriveFolderId_: extractDriveFolderId_,
    buildDailySummaryText_: buildDailySummaryText_,
    runScheduledChecks: runScheduledChecks,
    notifyCall: notifyCall
  };
}
