const mqtt = require('mqtt');

const client  = mqtt.connect(process.env.MQTTLOCAL);
client.on('connect', function () {
  console.log('connected');
  client.subscribe('livingroom/wall/light/httpbrightnessvalue');
  client.on("message", function (topic, message) {
    const brightnessPercentage =  parseInt(message.brightnessPercentage);
    const brightnessValue = Math.round(1024 * brightnessPercentage / 100)
    const brightnessValueString = brightnessValue.toString()
    client.publish('livingroom/wall/light',brightnessValueString);
  });
});


