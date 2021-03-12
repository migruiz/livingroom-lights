const http = require('http');


http.createServer((request, response) => {
  const { headers, method, url } = request;
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', async () => {
    body = Buffer.concat(body).toString();

    //const hookInfo = JSON.parse(body)
    console.log("data",body)
    response.end();
    
  });
}).listen(80);



