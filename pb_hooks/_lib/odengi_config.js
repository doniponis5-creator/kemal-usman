/* global module, $os, $app */
/* eslint-disable no-unused-vars, no-empty -- catch (_) {} — так пишут все хуки PocketBase 0.22 (goja) в этом репозитории */
// Ключи O!Деньги: сначала env процесса PocketBase (ODENGI_SID, ODENGI_PASSWORD),
// потом pb_data/odengi_credentials.json (его пишет deploy-odengi.sh из локального .env, в git его нет).
// Отдельный файл в _lib: функции из *.pb.js не видны внутри routerAdd.

// Файл → строка. Глобальный toString в PB 0.22 — это Object.prototype.toString («[object Undefined]»),
// JSON.parse падал, и запасной путь через файл не работал. Как в assistant_config.js — вручную.
// Файл — ASCII JSON, многобайтовых символов нет.
function bytesToString(bytes) {
  if (typeof bytes === 'string') return bytes;
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function read() {
  var cfg = {
    sid: $os.getenv('ODENGI_SID') || '',
    password: $os.getenv('ODENGI_PASSWORD') || '',
    apiUrl: 'https://api.dengi.o.kg/api/json/json.php',
    testMode: 0,
    resultBaseUrl: 'https://api.kemalusman.kg'
  };
  if (!cfg.sid || !cfg.password) {
    try {
      var cred = JSON.parse(bytesToString($os.readFile($app.dataDir() + '/odengi_credentials.json'))) || {};
      if (!cfg.sid && cred.sid) cfg.sid = String(cred.sid);
      if (!cfg.password && cred.password) cfg.password = String(cred.password);
      if (cred.apiUrl) cfg.apiUrl = String(cred.apiUrl);
      if (cred.testMode !== undefined) cfg.testMode = Number(cred.testMode) || 0;
      if (cred.resultBaseUrl) cfg.resultBaseUrl = String(cred.resultBaseUrl);
    } catch (e) {
      // Файла нет или он битый — обработчик ответит 503 payment_not_configured.
      try { $app.logger().warn('odengi: credentials not read', 'err', String(e)); } catch (_) {}
    }
  }
  return cfg;
}

module.exports = { read: read };
