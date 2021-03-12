const http = require('http');
const mqtt = require('mqtt');

http.createServer((request, response) => {
  const { headers, method, url } = request;
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', async () => {
    body = Buffer.concat(body).toString();
    console.log("lightsSetting",body)
    const lightsSetting = JSON.parse(body)
    const brightnessPercentage = lightsSetting.brightnessPercentage
    const brightnessValue = Math.round(1024 * brightnessPercentage / 100)
    

    const client  = mqtt.connect(process.env.MQTTLOCAL);
    client.on('connect', function () {
      console.log('entered');
        client.publish('livingroom/wall/light', brightnessValue.toString());
        client.end();
        response.status(200);
        response.end();
    })
    
    
    
  });
}).listen(80);



