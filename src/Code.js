/**
 * Entry point and RPC / JSON API endpoints for the Parents' Tablet web app.
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleJsonApi_(e.parameter.action, []);
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle("Parents' Tablet")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    return handleJsonApi_(body.action, Array.isArray(body.args) ? body.args : []);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function dispatchApi_(action, args) {
  var a = Array.isArray(args) ? args : [];
  switch (action) {
    case 'apiGetState': return apiGetState();
    case 'apiToggleDose': return apiToggleDose(a[0], a[1]);
    case 'apiClearPersonLogs': return apiClearPersonLogs(a[0], a[1]);
    case 'apiSaveMed': return apiSaveMed(a[0]);
    case 'apiDeleteMed': return apiDeleteMed(a[0]);
    case 'apiSaveSlot': return apiSaveSlot(a[0]);
    case 'apiUndoHistory': return apiUndoHistory(a[0]);
    case 'apiSaveConfig': return apiSaveConfig(a[0]);
    case 'apiGetPhotos': return apiGetPhotos();
    case 'apiNotifyCall': return apiNotifyCall(a[0], a[1]);
    case 'apiSaveTodos': return apiSaveTodos(a[0]);
    case 'apiSaveNotes': return apiSaveNotes(a[0]);
    case 'apiGetVideos': return apiGetVideos();
    case 'apiMarkVideoWatched': return apiMarkVideoWatched(a[0]);
    case 'apiGetAvatars': return apiGetAvatars();
    default: throw new Error('Unknown action: ' + action);
  }
}

function handleJsonApi_(action, args) {
  try {
    var data = dispatchApi_(action, args);
    return jsonResponse_({ ok: true, data: data });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function apiGetState() {
  return getAppState();
}

function apiToggleDose(medId, dateKey) {
  return toggleMedDose(medId, dateKey);
}

function apiClearPersonLogs(person, dateKey) {
  return clearPersonLogs(person, dateKey);
}

function apiSaveMed(medInput) {
  return saveMed(medInput);
}

function apiDeleteMed(medId) {
  return deleteMed(medId);
}

function apiSaveSlot(slotInput) {
  return saveSlot(slotInput);
}

function apiUndoHistory(historyId) {
  return undoHistory(historyId);
}

function apiSaveConfig(configInput) {
  return saveConfig(configInput);
}

function apiGetPhotos() {
  return getDrivePhotos();
}

function apiNotifyCall(who, customUrl) {
  return notifyCall(who, customUrl);
}

function apiSaveTodos(todos) {
  return saveTodos(todos);
}

function apiSaveNotes(notes) {
  return saveNotes(notes);
}

function apiGetVideos() {
  return getDriveVideos();
}

function apiMarkVideoWatched(videoId) {
  return markVideoWatched(videoId);
}

function apiGetAvatars() {
  return getAvatarMap();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dispatchApi_: dispatchApi_
  };
}
