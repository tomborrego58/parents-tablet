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
