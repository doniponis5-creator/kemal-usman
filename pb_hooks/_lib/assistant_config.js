/* global module, $os, $app */
// Настройки консультанта «Спросить»: сначала env процесса PocketBase, потом
// pb_data/assistant_credentials.json (его пишет deploy-odengi.sh из локального .env).
// Отдельный файл в _lib: функции из *.pb.js не видны внутри routerAdd.

// Байты файла → строка. Глобальный toString() из *.pb.js внутри require-модуля
// ненадёжен (на сервере ключ не читался), поэтому как в md5.js — вручную.
// Файл — ASCII JSON, многобайтовых символов нет.
function bytesToString(bytes) {
  if (typeof bytes === 'string') return bytes;
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function read() {
  var cfg = {
    key: $os.getenv('GEMINI_API_KEY') || '',
    model: $os.getenv('GEMINI_MODEL') || '',
    limit: Number($os.getenv('ASSISTANT_DAILY_LIMIT') || 0) || 0
  };
  if (!cfg.key) {
    try {
      var f = JSON.parse(bytesToString($os.readFile($app.dataDir() + '/assistant_credentials.json')));
      if (f.geminiKey) cfg.key = String(f.geminiKey);
      if (!cfg.model && f.model) cfg.model = String(f.model);
      if (!cfg.limit && f.dailyLimit) cfg.limit = Number(f.dailyLimit) || 0;
    } catch (e) {
      // Файла нет или он битый — работаем без ИИ, причину видно в журнале (scripts/assistant-diag.mjs).
      try { $app.logger().warn('assistant: credentials not read', 'err', String(e)); } catch (_) {}
    }
  }
  if (!cfg.model) cfg.model = 'gemini-3.8-flash';
  if (!cfg.limit) cfg.limit = 1500;
  return cfg;
}

module.exports = { read: read };
