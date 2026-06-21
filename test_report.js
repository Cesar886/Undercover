import http from 'http';
const req = http.request('http://localhost:3000/api/posts/f191f137-895e-4f53-a2fa-f9bf80d78ec4/report', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' } 
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', e => console.error(e));
req.write(JSON.stringify({ reason: 'spam' }));
req.end();
