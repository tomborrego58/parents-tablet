/**
 * Entry point and RPC endpoints for the Parents' Tablet web app.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle("Parents' Tablet")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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
