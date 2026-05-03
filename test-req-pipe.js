const http = require('http');

const targetServer = http.createServer((req, res) => {
  console.log('Target received request', req.method);
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    console.log('Target body length:', body.length);
    res.writeHead(200);
    res.end('OK');
  });
});
targetServer.listen(1235, () => {
  const proxyServer = http.createServer((req, res) => {
    console.log('Proxy received request', req.method);
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: 1235,
      method: req.method,
      headers: req.headers
    }, proxyRes => {
      proxyRes.pipe(res);
    });
    req.pipe(proxyReq);
  });
  proxyServer.listen(3001, () => {
    const clientReq = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      method: 'POST',
      headers: { 'Content-Length': 5 }
    }, clientRes => {
      console.log('Client received status:', clientRes.statusCode);
      process.exit(0);
    });
    clientReq.write('hello');
    clientReq.end();
  });
});
