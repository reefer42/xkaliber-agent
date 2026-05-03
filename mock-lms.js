const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`[LMS MOCK] Received ${req.method} ${req.url}`);
  console.log(req.headers);
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    console.log(`[LMS MOCK] Body: ${body}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created: 123,
      model: "mock-model",
      choices: [{ delta: { content: "Hello from mock!" }, index: 0 }]
    }));
  });
});

server.listen(1234, '127.0.0.1', () => {
  console.log('[LMS MOCK] Listening on 127.0.0.1:1234');
});
