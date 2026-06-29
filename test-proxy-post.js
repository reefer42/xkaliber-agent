const http = require('http');

const body = JSON.stringify({
  model: 'test',
  messages: [{ role: 'user', content: 'test' }]
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/proxy/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-target-url': 'http://127.0.0.1:1234/v1/chat/completions',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', error => {
  console.error(error);
});

req.write(body);
req.end();
