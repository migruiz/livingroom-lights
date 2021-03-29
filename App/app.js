const mqtt = require('mqtt');  
var spawn = require('child_process').spawn;

const LED_LIGHTS_TOPIC = 'livingroom/wall/light/httpbrightnessvalue';
const FIRE_ON_TOPIC = 'livingroom/wall/fireplace/httpon';
const FIRE_OFF_TOPIC = 'livingroom/wall/fireplace/httpoff';

const RM_IP = '192.168.0.9';
const RM_MAC = '780f77ec0ca4';
const FIRE_ON_IR_CODE = '2600880100012a591242121a131a1319121b121a1440123e1719131a111b111b131a121a121b121a121b13191419121a1143121a1440121b121a11431241131a12421241131a111b1419121a12421242121a121b121a111c1319121a13411242121a121b111b111c121a121a14401242121a131a121a121b121a121b11421341121a131a1319131a111b141911421341121b121a111c121a121a131a12421241131a121a131a121a131a121a12421242121a121b121a121a131a121a12421242121a131a121a121b121a121a12421242121a121b121a121b121a121b12411341121b121a121a131a121a121b12411341121b121a121b121a121a131a11431241131a121a131a121a111c121a11431241131a121a131a121a121b121a12421242121a121b121a121a13411242121a121b121a121b121a121b121a121a131a121a121b121a111c121a121b121a121a131a121a121b111b121b121a121a131a121a131a121a121b121a121b121a121b121a121a131a121a121b121a1242121b111b114213411341124212000d05';
const FIRE_OFF_IR_CODE = '2600880100012a591143111b1319121b1319121b13411319111c111b111b121b111b121b111b111c111b111b1419111b1242111c1142111c131913411143111b11431142121b111b1419111b12421242111b121b111b111b121b111b12421143111b111c111b121a121b111b12421143111b131a111b111c121a121a12421143121a121b121a121b121a121b11421341111c111b121a121b111b121b11421341111c111b111c111b121a131a12421142121b121a111c121a111c111b12421241131a121a121b121a131a121a11431242121a121b121a121a131a111b12421143121a121b111b121b111b121b12411341111c121a111b121b121a131a12411341121b121a121b121a121a121b12421142131a111b131a121a121b111b12421241131a121a131a121a12421242121a111b121b121a121b121a121b121a111c111b121a121b111b121b111b121b111b111c121a121a131a121a131a111b111c111b111b131a111b121b121a131a111b111c121a121a131a111b121b1142131a111b124211431241131a12000d05'

const client  = mqtt.connect(process.env.MQTTLOCAL);
client.on('connect', function () {
  console.log('connected');
  client.subscribe(LED_LIGHTS_TOPIC);
  client.subscribe(FIRE_ON_TOPIC);
  client.subscribe(FIRE_OFF_TOPIC);
  client.on("message", async function (topic, message) {
    if (topic===LED_LIGHTS_TOPIC){
      const brightnessPercentage =  parseInt(message);
      const brightnessValue = Math.round(1024 * brightnessPercentage / 100)
      const brightnessValueString = brightnessValue.toString()
      client.publish('livingroom/wall/light',brightnessValueString);
    }
    else  if (topic===FIRE_ON_TOPIC){
      await execCommandAsync(FIRE_ON_IR_CODE);
    }
    else  if (topic===FIRE_OFF_TOPIC){
      await execCommandAsync(FIRE_OFF_IR_CODE);
    }
  });
});


function execCommandAsync(code) {
  return new Promise(function (resolve, reject) {
      const command = spawn('/python-broadlink/cli/broadlink_cli'
          , [
              '--type'
              , '0x2737'
              , '--host'
              , RM_IP
              , '--mac'
              , RM_MAC
              , '--send'
              , code
          ]);
      command.stdout.on('data', data => {
          console.log(data.toString());
      });
      command.on('exit', function (code, signal) {
          console.log('exited');
          resolve();
      });
  });
}