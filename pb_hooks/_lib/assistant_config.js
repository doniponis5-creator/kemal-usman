/* global module, $os, $app, toString */
// Настройки консультанта «Спросить»: сначала env процесса PocketBase, потом
// pb_data/assistant_credentials.json (его пишет deploy-odengi.sh из локального .env).
// Отдельный файл в _lib: функции из *.pb.js не видны внутри routerAdd.

function read() {
  var cfg = {
    key: $os.getenv('GEMINI_API_KEY') || '',
    model: $os.getenv('GEMINI_MODEL') || '',
    limit: Number($os.getenv('ASSISTANT_DAILY_LIMIT') || 0) || 0
  };
  if (!cfg.key) {
    try {
      var f = JSON.parse(toString($os.readFile($app.dataDir() + '/assistant_credentials.json')));
      if (f.geminiKey) cfg.key = String(f.geminiKey);
      if (!cfg.model && f.model) cfg.model = String(f.model);
      if (!cfg.limit && f.dailyLimit) cfg.limit = Number(f.dailyLimit) || 0;
    } catch (_) { /* файла нет — работаем без ИИ */ }
  }
  if (!cfg.model) cfg.model = 'gemini-3.8-flash';
  if (!cfg.limit) cfg.limit = 1500;
  return cfg;
}

module.exports = { read: read };
