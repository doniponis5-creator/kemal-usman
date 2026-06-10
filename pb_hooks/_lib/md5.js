// MD5 + HMAC-MD5 for PocketBase JSVM using $security.md5 + $os.cmd(python3)
// Usage:
//   var md5 = require(__hooks + '/_lib/md5.js');
//   md5('hello')         → MD5 hex (uses $security.md5)
//   md5.hmac(msg, key)   → HMAC-MD5 hex (uses python3 hmac)

function md5(inputStr) {
  return $security.md5(String(inputStr));
}

function hmacMD5(message, key) {
  var tmpFile = '/tmp/hmac_' + Date.now() + '.txt';
  var pyCode = "import hmac,hashlib,sys;open('" + tmpFile + "','w').write(hmac.new(sys.argv[1].encode('utf-8'),sys.argv[2].encode('utf-8'),hashlib.md5).hexdigest())";
  
  try {
    var cmd = $os.cmd('python3', '-c', pyCode, String(key), String(message));
    cmd.run();
    
    var resultBytes = $os.readFile(tmpFile);
    var result = '';
    for (var i = 0; i < resultBytes.length; i++) {
      result += String.fromCharCode(resultBytes[i]);
    }
    
    // Cleanup
    try { $os.remove(tmpFile); } catch(_) {}
    
    return result.trim();
  } catch(e) {
    $app.logger().error('hmac_md5_error', 'error', String(e));
    throw new Error('HMAC-MD5 failed: ' + String(e));
  }
}

md5.hmac = hmacMD5;
module.exports = md5;
