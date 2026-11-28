/**
 * Builds the standalone GitHub Pages frontend (docs/app/index.html)
 * directly from src/Styles.html and src/App.html so there is zero UI duplication.
 * No private URLs, emails, or health data are embedded in the output.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'src', 'Styles.html'), 'utf8');
const appScript = fs.readFileSync(path.join(root, 'src', 'App.html'), 'utf8');

const shim = `<script>
(function () {
  var STORAGE_KEY = 'pt_api_url_v1';
  var TOKEN_KEY = 'pt_api_token_v1';
  var params = new URLSearchParams(window.location.search);
  var paramApi = params.get('api');
  var paramToken = params.get('token');
  if (paramToken) {
    localStorage.setItem(TOKEN_KEY, paramToken.trim());
  }
  if (paramApi && paramApi.indexOf('https://script.google.com/') === 0) {
    localStorage.setItem(STORAGE_KEY, paramApi.trim());
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
  } else if (paramToken) {
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
  }

  var apiUrl = localStorage.getItem(STORAGE_KEY) || '';
  var apiToken = localStorage.getItem(TOKEN_KEY) || '';

  if (!apiUrl) {
    window.__PT_NEEDS_API_URL = true;
    window.addEventListener('DOMContentLoaded', function () {
      var app = document.getElementById('app');
      if (!app) return;
      app.innerHTML =
        '<div style="max-width:680px;margin:60px auto;background:#fff;color:#1b1b1b;padding:28px;border-radius:20px">' +
          '<h1 style="font-size:30px;margin-bottom:10px">Parents\\' Tablet — Connect</h1>' +
          '<p style="font-size:20px;color:#444;margin-bottom:16px">Paste your Google Apps Script Web App URL once to link this device:</p>' +
          '<input id="pt-api-in" class="field" placeholder="https://script.google.com/macros/s/.../exec">' +
          '<button id="pt-api-save" class="btn call" style="width:100%;height:68px;margin-top:16px">Connect</button>' +
        '</div>';
      document.getElementById('pt-api-save').addEventListener('click', function () {
        var val = (document.getElementById('pt-api-in').value || '').trim();
        if (val.indexOf('https://script.google.com/') !== 0) {
          alert('Please paste the full https://script.google.com/macros/s/.../exec URL.');
          return;
        }
        localStorage.setItem(STORAGE_KEY, val);
        window.location.reload();
      });
    });
    return;
  }

  var METHODS = [
    'apiGetState', 'apiToggleDose', 'apiClearPersonLogs', 'apiSaveMed',
    'apiDeleteMed', 'apiSaveSlot', 'apiUndoHistory', 'apiSaveConfig',
    'apiGetPhotos', 'apiGetPhotoData', 'apiNotifyCall', 'apiSaveTodos', 'apiSaveNotes',
    'apiGetVideos', 'apiMarkVideoWatched', 'apiGetAvatars'
  ];

  function createRunner(onOk, onErr) {
    var runner = {
      withSuccessHandler: function (fn) { return createRunner(fn, onErr); },
      withFailureHandler: function (fn) { return createRunner(onOk, fn); }
    };
    METHODS.forEach(function (method) {
      runner[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        var payload = { action: method, args: args };
        if (apiToken) payload.token = apiToken;
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 35000) : null;
        var fetchOpts = {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        };
        if (ctrl) fetchOpts.signal = ctrl.signal;
        fetch(apiUrl, fetchOpts)
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (timer) clearTimeout(timer);
            if (json && json.ok) {
              if (onOk) onOk(json.data);
            } else {
              var err = new Error((json && json.error) || 'API error');
              if (onErr) onErr(err);
            }
          })
          .catch(function (err) {
            if (timer) clearTimeout(timer);
            if (onErr) onErr(err);
          });
      };
    });
    return runner;
  }

  window.google = {
    script: {
      run: createRunner(null, null)
    }
  };
})();
</script>`;

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#241773">
  <link rel="manifest" href="manifest.json">
  <title>Parents' Tablet</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap" rel="stylesheet">
${styles}
</head>
<body>
  <div id="app">
    <div class="loading">Loading Parents' Tablet…</div>
  </div>
  <div id="toast" class="toast" aria-live="polite"></div>
${shim}
${appScript}
</body>
</html>
`;

const outDir = path.join(root, 'docs', 'app');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
console.log('Built docs/app/index.html (' + html.length + ' bytes)');
