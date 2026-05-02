// Pluggable SMS sender. Configured by env: SMS_PROVIDER=smsc (default) | nikita | log
// Fill SMS_API_LOGIN / SMS_API_PASSWORD on the server.

module.exports = {
  send(phone, text) {
    const provider = $os.getenv('SMS_PROVIDER') || 'log';
    if (provider === 'log') {
      $app.logger().info('[SMS:log] ' + phone + ' -> ' + text);
      return;
    }
    if (provider === 'smsc') {
      const login = $os.getenv('SMS_API_LOGIN');
      const password = $os.getenv('SMS_API_PASSWORD');
      const sender = $os.getenv('SMS_SENDER') || 'KemalUsman';
      const url =
        'https://smsc.kg/sys/send.php?login=' + encodeURIComponent(login) +
        '&psw=' + encodeURIComponent(password) +
        '&phones=' + encodeURIComponent(phone) +
        '&mes=' + encodeURIComponent(text) +
        '&sender=' + encodeURIComponent(sender) +
        '&fmt=3';
      const res = $http.send({ url, method: 'GET', timeout: 10 });
      if (res.statusCode >= 400) throw new Error('SMSC error ' + res.statusCode);
      return;
    }
    throw new Error('Unknown SMS provider: ' + provider);
  },
};
