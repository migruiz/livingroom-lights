const { Observable, Subject, merge, timer, interval } = require('rxjs');
const { mergeMap, withLatestFrom, map, share, shareReplay, filter, mapTo, take, debounceTime, throttle, throttleTime, startWith, takeWhile, delay, scan, distinct, distinctUntilChanged, tap, flatMap, takeUntil, toArray, groupBy } = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
var http = require('http');
global.mtqqLocalPath = process.env.MQTTLOCAL || 'mqtt://192.168.0.11';
var spawn = require('child_process').spawn;
const CronJob = require('cron').CronJob;
const { DateTime } = require('luxon');

const LED_LIGHTS_TOPIC = 'livingroom/wall/light/httpbrightnessvalue';
const FIRE_ON_TOPIC = 'livingroom/wall/fireplace/httpon';
const FIRE_OFF_TOPIC = 'livingroom/wall/fireplace/httpoff';
const FIRE_FLAME_CHANGE_TOPIC = 'livingroom/wall/fireplace/httpflamechange';

const LED_CONTROL = 'zigbee2mqtt/0x2c1165fffecad895';


const RM_IP = '192.168.0.9';
const RM_MAC = '780f77ec0ca4';
const FIRE_ON_IR_CODE = '2600880100012a591242121a131a1319121b121a1440123e1719131a111b111b131a121a121b121a121b13191419121a1143121a1440121b121a11431241131a12421241131a111b1419121a12421242121a121b121a111c1319121a13411242121a121b111b111c121a121a14401242121a131a121a121b121a121b11421341121a131a1319131a111b141911421341121b121a111c121a121a131a12421241131a121a131a121a131a121a12421242121a121b121a121a131a121a12421242121a131a121a121b121a121a12421242121a121b121a121b121a121b12411341121b121a121a131a121a121b12411341121b121a121b121a121a131a11431241131a121a131a121a111c121a11431241131a121a131a121a121b121a12421242121a121b121a121a13411242121a121b121a121b121a121b121a121a131a121a121b121a111c121a121b121a121a131a121a121b111b121b121a121a131a121a131a121a121b121a121b121a121b121a121a131a121a121b121a1242121b111b114213411341124212000d05';
const FIRE_OFF_IR_CODE = '2600880100012a591143111b1319121b1319121b13411319111c111b111b121b111b121b111b111c111b111b1419111b1242111c1142111c131913411143111b11431142121b111b1419111b12421242111b121b111b111b121b111b12421143111b111c111b121a121b111b12421143111b131a111b111c121a121a12421143121a121b121a121b121a121b11421341111c111b121a121b111b121b11421341111c111b111c111b121a131a12421142121b121a111c121a111c111b12421241131a121a121b121a131a121a11431242121a121b121a121a131a111b12421143121a121b111b121b111b121b12411341111c121a111b121b121a131a12411341121b121a121b121a121a121b12421142131a111b131a121a121b111b12421241131a121a131a121a12421242121a111b121b121a121b121a121b121a111c111b121a121b111b121b111b121b111b111c121a121a131a121a131a111b111c111b111b131a111b121b121a131a111b111c121a121a131a111b121b1142131a111b124211431241131a12000d05'
const FIRE_FLAME_CHANGE_IR_CODE = '26008c0100012b581341121b121a121a131a1242121a1242121a131a121a131a121a131a121a121b12411419121a131a1242121a1242121a131a121a121b121a121b1241121b121a131a121a12421242121a121b121a121b121a121a13411440121a131a121a131a121a131a12411341121b121a121b121a111c121a12421241131a121a131a121a131a121a13411242121a121b121a121b111b121a13411242121a121b121a121b121a121b12411242121b121a111b131a121a131a12421241131a121a121b121a121b121a11431241131a121a131a121a121b111b12421242121a121a131a121a131a111b12421242121a131a121a121b121a111b13411242121a131a121b121a111b121b12411341121b111b121b121a121a131a12421241131a121a131a121a12421242121a12421242121a121b1241131a121a121b121a121b121a1419121a111c1319121a131a1319121b121a121b121a121b121a121a131a121a1419121a121b121a1419121a121b121a111b1419114313191143121a1440121b1241131a130006e70c000d05000000000000000000000000';




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
      resolve();
    });
    // No broadlink_cli (running off the Pi, for a test): say so rather than crash.
    command.on('error', function (error) {
      console.log(error.message);
      resolve();
    });
  });
}

console.log(`Living Room lights current time ${DateTime.now()}`);

// The kitchen iPad's lights screen: GET/POST /living-room, passed through by nginx on the Pi
// (the screens container in C:/repos/home-assistant).
const SCREEN_PORT = 8769
const LAMPS = ['zigbee2mqtt/0x2c1165fffed897d3', 'zigbee2mqtt/0x2c1165fffed8947e'];
// Seconds the fireplace takes to wake up once its socket is switched on, before it hears the
// remote's codes.
const FIRE_WAKE_UP = 3 * 1000;

// What the screen sends in: changes to the wall lights and the fire (into their streams below),
// and to the lamps.
const wallScreen = new Subject();
const lampsScreen = new Subject();
// The master switch's presses that change the wall lights or the fire behind their streams' backs.
const masterSwitchEvents = new Subject();

// What the screen is shown. `living` is the wall lights and fire as their stream last left them.
let living = null;
const lamps = {};       // each lamp as it last reported, by topic
const lampsOnline = {}; // whether Zigbee2MQTT can reach each lamp (not when its own switch is off)
let lampsWanted = null; // what the screen last asked the lamps for, until they report it
// The relays on the media unit (TV) and the fireplace's socket: null until something here
// switches them, as they don't report.
const relays = { tv: null, fire: null, fireOnAt: 0 };

async function setRelay(name, on) {
  const cluster = await mqtt.getClusterAsync();
  if (name === 'fire') {
    if (on && relays.fire !== true) relays.fireOnAt = Date.now();
    relays.fire = on;
    cluster.publishMessage('livingroom/fire/state', on ? 'on' : 'off');
  } else {
    relays.tv = on;
    cluster.publishMessage('livingroom/media/state', on ? 'on' : 'off');
  }
}


//wall lights
(function () {



  const sunRiseSetHourByMonth = {
    1: {
      sunRise: 9,
      sunSet: 16
    },
    2: {
      sunRise: 9,
      sunSet: 17
    },
    3: {
      sunRise: 8,
      sunSet: 18
    },
    4: {
      sunRise: 7,
      sunSet: 19
    },
    5: {
      sunRise: 6,
      sunSet: 20
    },
    6: {
      sunRise: 6,
      sunSet: 21
    },
    7: {
      sunRise: 6,
      sunSet: 21
    },
    8: {
      sunRise: 6,
      sunSet: 20
    },
    9: {
      sunRise: 6,
      sunSet: 19
    },
    10: {
      sunRise: 7,
      sunSet: 18
    },
    11: {
      sunRise: 8,
      sunSet: 17
    },
    12: {
      sunRise: 9,
      sunSet: 16
    },
  }
  const everyHourStream = new Observable(subscriber => {
    new CronJob(
      `0 * * * *`,
      function () {
        subscriber.next(true);
      },
      null,
      true,
      'Europe/Dublin'
    );
  });
  const sharedHourStream = everyHourStream.pipe(share())
  const sunRiseStream = sharedHourStream.pipe(
    mapTo(sunRiseSetHourByMonth[DateTime.now().month].sunRise),
    filter(sunRiseHour => DateTime.now().hour === sunRiseHour),
    map(sunRiseHour => ({ type: 'sunRise', hour: sunRiseHour }))
  )
  const sunSetStream = sharedHourStream.pipe(
    mapTo(sunRiseSetHourByMonth[DateTime.now().month].sunSet),
    filter(sunSetHour => DateTime.now().hour === sunSetHour),
    map(sunSetHour => ({ type: 'sunSet', hour: sunSetHour }))
  )

  const sensorLivingRoomStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d00056bad56', function (content) {
      if (content.occupancy) {
        subscriber.next(content)
      }
    });
  });
  const sensorEntranceRoomStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d000566c0cc', function (content) {
      if (content.occupancy) {
        subscriber.next(content)
      }
    });
  });

  const sensorStream = merge(sensorLivingRoomStream,sensorEntranceRoomStream)

  const sharedSensorStream = sensorStream.pipe(
    share()
  )
  const turnOffStream = sharedSensorStream.pipe(
    debounceTime(4 * 60 * 1000),
    mapTo("off"),
    share()
  )

  const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    mapTo("on")
  )
  const autoOnOffStream = merge(turnOnStream, turnOffStream).pipe(
    map(e => ({ type: 'auto', occupancy: e === 'on' }))
  )


  const buttonControl = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x187a3efffefaa676', function (content) {
      subscriber.next(content)
    });
  });


  const masterButtonStream = buttonControl.pipe(
    filter(c =>
      c.action === 'brightness_step_up' ||
      c.action === 'brightness_step_down' ||
      c.action === 'toggle' ||
      c.action === 'color_temperature_step_up' ||
      c.action === 'color_temperature_step_down'
    ),
    map(c => {
      const { action } = c;
      if (action === 'toggle') return { type: "toggle" }
      else if (action === 'brightness_step_down') return { type: "lightsDown", value: c.action_step_size * 2 }
      else if (action === 'brightness_step_up') return { type: "lightsUp", value: c.action_step_size * 2 }
      else if (action === 'color_temperature_step_up') return { type: "changeFirePlaceColor" }
      else if (action === 'color_temperature_step_down') return { type: "changeFirePlaceColor" }
    })
  )

  // Screen changes: {type: 'screenWall', brightness} (0 is off), {type: 'screenFire', on},
  // {type: 'screenFlame'}. Master switch: {type: 'fireSocket', on}, {type: 'allOff'}.
  const screenStream = merge(wallScreen, masterSwitchEvents)

  // Whether motion is in charge is kept apart for the wall lights and the fire (lightsArmed,
  // fireArmed), so the screen can switch one without the other. The button, sunrise and sunset
  // always set both, as they did when there was one switch for the two.
  const combinedStream = merge(autoOnOffStream, masterButtonStream, sunRiseStream, sunSetStream, screenStream).pipe(
    scan((acc, curr) => {
      if (curr.type === 'toggle') return {...acc, type: curr.type, lightsArmed: !acc.lightsArmed, fireArmed: !acc.lightsArmed, lightsOn: !acc.lightsArmed, brightness: 100, fireOn: !acc.lightsArmed }
      if (curr.type === 'lightsDown') return { ...acc, type: curr.type, lightsArmed: true, fireArmed: true, lightsOn: true, brightness: acc.brightness - curr.value < 2 ? 2 : acc.brightness - curr.value, fireOn: true }
      if (curr.type === 'lightsUp') return { ...acc, type: curr.type, lightsArmed: true, fireArmed: true, lightsOn: true, brightness: acc.brightness + curr.value > 1000 ? 1000 : acc.brightness + curr.value, fireOn: true}
      if (curr.type === 'changeFirePlaceColor') return { ...acc, type: curr.type, lightsArmed: true, fireArmed: true, lightsOn: true, fireOn: true, changeFirePlaceColorReqNumber: acc.changeFirePlaceColorReqNumber + 1 }
      if (curr.type === 'sunRise') return { ...acc, type: curr.type, lightsArmed: false, fireArmed: false, lightsOn: false, fireOn: false }
      // Lights what motion has asked for while it wasn't in charge, as it always did.
      if (curr.type === 'sunSet') return { ...acc, type: curr.type, lightsArmed: true, fireArmed: true, lightsOn: acc.lightsArmed ? acc.lightsOn : acc.occupied, fireOn: acc.fireArmed ? acc.fireOn : acc.occupied }
      if (curr.type === 'auto') return { ...acc, type: acc.lightsArmed || acc.fireArmed ? curr.type : 'omit', occupied: curr.occupancy, lightsOn: acc.lightsArmed ? curr.occupancy : acc.lightsOn, fireOn: acc.fireArmed ? curr.occupancy : acc.fireOn }
      // The screen's wall lights slider, like the kitchen's: a level turns them on and gives
      // motion back the lights; 0 turns them off and leaves them off until the slider goes up,
      // the button is pressed or the sun sets.
      if (curr.type === 'screenWall') return curr.brightness > 0
        ? { ...acc, type: curr.type, lightsArmed: true, lightsOn: true, brightness: curr.brightness }
        : { ...acc, type: curr.type, lightsArmed: false, lightsOn: false }
      // The screen's fire switch: on or off, and it stays so whatever motion does.
      if (curr.type === 'screenFire') return { ...acc, type: curr.type, fireArmed: false, fireOn: curr.on }
      if (curr.type === 'screenFlame') return { ...acc, type: curr.type, fireArmed: false, fireOn: true, changeFirePlaceColorReqNumber: acc.changeFirePlaceColorReqNumber + 1 }
      // The master switch cut or restored the fire's socket (the fire lights by itself when
      // its socket comes on), or turned everything off: only noted, the switch did it.
      if (curr.type === 'fireSocket') return { ...acc, type: curr.type, fireOn: curr.on }
      if (curr.type === 'allOff') return { ...acc, type: curr.type, lightsOn: false, fireOn: false }

    }, { type: 'init', lightsArmed: false, fireArmed: false, occupied: false, lightsOn: false, brightness: 100, fireOn: false, changeFirePlaceColorReqNumber: 0 }),
    filter(e => e.type !== 'omit'),
    share()

  );

  combinedStream.subscribe(m => { living = m });

  const lightsStream = combinedStream.pipe(
    distinctUntilChanged((prev,curr) => {
     return prev.lightsOn===curr.lightsOn && prev.brightness===curr.brightness
    }),
    map(({lightsOn,brightness }) => ({lightsOn,brightness}))
  )

  const fireColorStream = combinedStream.pipe(
    distinctUntilChanged((prev,curr) => {
     return prev.changeFirePlaceColorReqNumber===curr.changeFirePlaceColorReqNumber
    }),
    map(({changeFirePlaceColorReqNumber}) => changeFirePlaceColorReqNumber),
    filter(e => e !== 0),
    throttleTime(1200)
  )
  const fireOnStream = combinedStream.pipe(
    distinctUntilChanged((prev,curr) => {
     return prev.fireOn===curr.fireOn
    }),
    // The master switch already did it, with the fire's socket.
    filter(({type}) => type !== 'fireSocket' && type !== 'allOff'),
    map(({fireOn}) => fireOn)
  )

  fireOnStream
  .subscribe(async m => {
    if (m) {
      // Its socket has only just come on: give it time to wake up, then light it unless
      // something has put it out meanwhile.
      const waking = FIRE_WAKE_UP - (Date.now() - relays.fireOnAt);
      if (waking > 0) {
        await new Promise(resolve => setTimeout(resolve, waking));
        if (!living.fireOn) return;
      }
      await execCommandAsync(FIRE_ON_IR_CODE);
    }
    else {
      await execCommandAsync(FIRE_OFF_IR_CODE);
    }
  })

  fireColorStream
    .subscribe(async m => {
      await execCommandAsync(FIRE_FLAME_CHANGE_IR_CODE);
    })

  lightsStream
    .subscribe(async m => {
      if (m.lightsOn) {
        (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', m.brightness.toString());
      }
      else {
        (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', '0');
      }
    })


})();


//lamps
(function () {



  const buttonControl = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0xe8e07efffec08fd1', function (content) {
      subscriber.next(content)
    });
  });


  const masterButtonStream = buttonControl.pipe(
    filter(c =>
      c.action === 'brightness_step_up' ||
      c.action === 'brightness_step_down' ||
      c.action === 'toggle' ||
      c.action === 'color_temperature_step_up' ||
      c.action === 'color_temperature_step_down'
    )
  )

  // The screen's lamps controls, {action: 'set', brightness} (0 is off) or {action: 'set',
  // colorTemp}: in the same stream as the switch, so its next press carries on from them.
  const brightnessActionStream = merge(masterButtonStream, lampsScreen).pipe(
    scan((acc, curr) => {
      if (curr.action === 'set') return { brigthnessValue: curr.brightness || acc.brigthnessValue, colorTemp: curr.colorTemp || acc.colorTemp, action: 'set', set: curr }
      if (curr.action === 'brightness_step_up') return { brigthnessValue: acc.brigthnessValue + 30 > 254 ? 254 : acc.brigthnessValue + 30, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'brightness_step_down') return { brigthnessValue: acc.brigthnessValue - 30 < 2 ? 2 : acc.brigthnessValue - 30, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'color_temperature_step_up') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp + 30 > 454 ? 454 : acc.colorTemp + 30, action: 'color' }
      if (curr.action === 'color_temperature_step_down') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp - 30 < 250 ? 250 : acc.colorTemp - 30, action: 'color' }
      if (curr.action === 'toggle') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp, action: 'toggle' }

    }, { brigthnessValue: 0, colorTemp: 0 })
  )


  brightnessActionStream.subscribe(async m => {
    if (m.action === 'brigthness') {
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed897d3/set', JSON.stringify({ brightness: m.brigthnessValue }));
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed8947e/set', JSON.stringify({ brightness: m.brigthnessValue }));
    }
    else if (m.action === 'color') {
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed897d3/set', JSON.stringify({ color_temp: m.colorTemp }));
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed8947e/set', JSON.stringify({ color_temp: m.colorTemp }));
    }
    else if (m.action === 'toggle') {
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed897d3/set', JSON.stringify({ state: 'TOGGLE' }));
      (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed8947e/set', JSON.stringify({ state: 'TOGGLE' }));
    }
    else if (m.action === 'set') {
      const { brightness, colorTemp } = m.set;
      const change = brightness === 0 ? { state: 'OFF' }
        : brightness ? { state: 'ON', brightness }
        : { color_temp: colorTemp };
      for (const lamp of LAMPS) (await mqtt.getClusterAsync()).publishMessage(`${lamp}/set`, JSON.stringify(change));
    }

  })

  // What the lamps say they are doing, for the screen. They only report changes: ask them once.
  mqtt.getClusterAsync().then(cluster => {
    for (const lamp of LAMPS) {
      cluster.subscribeData(lamp, content => { lamps[lamp] = content });
      cluster.subscribeData(`${lamp}/availability`, content => { lampsOnline[lamp] = content.state === 'online' });
      cluster.publishMessage(`${lamp}/get`, JSON.stringify({ state: '', brightness: '', color_temp: '' }));
    }
  });
})();






//master switch
(function () {
  const remoteStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0xc4d8c8fffe39a866', function (content) {
      subscriber.next(content)
    });
  });
  const sharedStream = remoteStream.pipe(share())

  const onMediaStream = sharedStream.pipe(
    filter(m => m.action === 'on')
  )
  const offMediaStream = sharedStream.pipe(
    filter(m => m.action === 'off')
  )
  const onFireStream = sharedStream.pipe(
    filter(m => m.action === 'brightness_move_up')
  )

  const offFireStream = sharedStream.pipe(
    filter(m => m.action === 'brightness_move_down')
  )

  // Each press is also told to the wall lights and fire stream, so the screen shows it.
  onMediaStream.subscribe(async m => {
    await setRelay('tv', true);
    await setRelay('fire', true);
    masterSwitchEvents.next({ type: 'fireSocket', on: true });
  })
  offMediaStream.subscribe(async m => {
    await setRelay('tv', false);
    await setRelay('fire', false);
    (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', '0');
    (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed8947e/set', JSON.stringify({ brightness: 0 }));
    (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed897d3/set', JSON.stringify({ brightness: 0 }));
    lampsWanted = null;  // the lamps' own report is the news now
    masterSwitchEvents.next({ type: 'allOff' });
  })

  onFireStream.subscribe(async m => {
    await setRelay('fire', true);
    masterSwitchEvents.next({ type: 'fireSocket', on: true });
  })
  offFireStream.subscribe(async m => {
    await setRelay('fire', false);
    masterSwitchEvents.next({ type: 'fireSocket', on: false });
  })


})();



// --- The kitchen iPad's lights screen ---------------------------------------------------

// The lamps as they last reported (any lit one, else the first): brightness 1 to 254, colour
// temperature in mireds (250 cool to 454 warm), and reachable: false when Zigbee2MQTT can't reach
// either (switched off at the lamp), null until it has said. For 3 seconds after the screen
// changes them, what it asked for, as they take a moment to report it.
function lampsState() {
  const known = LAMPS.filter(lamp => lamp in lampsOnline);
  const reachable = known.length ? known.some(lamp => lampsOnline[lamp]) : null;
  if (reachable === false) return { on: false, brightness: null, colorTemp: null, reachable };
  const reports = LAMPS.map(lamp => lamps[lamp]).filter(Boolean);
  const lit = reports.filter(report => report.state === 'ON');
  const shown = lit[0] || reports[0];
  const state = shown
    ? { on: lit.length > 0, brightness: shown.brightness === undefined ? null : shown.brightness, colorTemp: shown.color_temp === undefined ? null : shown.color_temp }
    : { on: null, brightness: null, colorTemp: null };
  state.reachable = reachable;
  if (lampsWanted && Date.now() - lampsWanted.at < 3000) {
    if (lampsWanted.brightness === 0) state.on = false;
    else if (lampsWanted.brightness) Object.assign(state, { on: true, brightness: lampsWanted.brightness });
    if (lampsWanted.colorTemp) state.colorTemp = lampsWanted.colorTemp;
  }
  return state;
}

// What the screen shows. wall: on now, brightness 2 to 1000, and whether motion is in charge;
// fire: lit or not; tv: the media unit's socket, null until something here switches it.
function screenState() {
  const wall = living || { lightsOn: false, brightness: 100, lightsArmed: false, fireOn: false };
  return {
    wall: { on: wall.lightsOn, brightness: wall.brightness, automatic: wall.lightsArmed },
    lamps: lampsState(),
    fire: { on: wall.fireOn },
    tv: { on: relays.tv },
  };
}

const isLevel = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
// What the screen asked the lamps for in the last 3 seconds, which a new change adds to.
const wantedLamps = () => (lampsWanted && Date.now() - lampsWanted.at < 3000 ? lampsWanted : {});

// One change per request: {wall: {brightness}} (0 off), {lamps: {brightness}} (0 off),
// {lamps: {colorTemp}}, {fire: {on}}, {fire: {flame: true}} or {tv: {on}}.
async function screenChange(change) {
  const { wall, lamps: lampsChange, fire, tv } = change || {};
  if (wall && isLevel(wall.brightness, 1000)) {
    wallScreen.next({ type: 'screenWall', brightness: wall.brightness && Math.max(2, wall.brightness) });
  } else if (lampsChange && isLevel(lampsChange.brightness, 254)) {
    lampsWanted = Object.assign(wantedLamps(), { brightness: lampsChange.brightness, at: Date.now() });
    lampsScreen.next({ action: 'set', brightness: lampsChange.brightness });
  } else if (lampsChange && Number.isInteger(lampsChange.colorTemp) && lampsChange.colorTemp >= 150 && lampsChange.colorTemp <= 500) {
    lampsWanted = Object.assign(wantedLamps(), { colorTemp: lampsChange.colorTemp, at: Date.now() });
    lampsScreen.next({ action: 'set', colorTemp: lampsChange.colorTemp });
  } else if (fire && typeof fire.on === 'boolean') {
    // On is its socket and then the remote's on (it waits for the socket, above); off is
    // only the remote's off, like the button, so the button can light it again.
    if (fire.on) await setRelay('fire', true);
    wallScreen.next({ type: 'screenFire', on: fire.on });
  } else if (fire && fire.flame === true) {
    await setRelay('fire', true);
    wallScreen.next({ type: 'screenFlame' });
  } else if (tv && typeof tv.on === 'boolean') {
    await setRelay('tv', tv.on);
  } else {
    return false;
  }
  return true;
}

http.createServer((req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.url !== '/living-room') return reply(404, { error: 'only /living-room' });
  if (req.method === 'GET') return reply(200, screenState());
  if (req.method !== 'POST') return reply(405, { error: 'GET or POST /living-room' });
  let body = '';
  req.on('data', chunk => { body += chunk });
  req.on('end', async () => {
    let change;
    try { change = JSON.parse(body) } catch (e) {}
    try {
      if (!(await screenChange(change))) return reply(400, { error: 'send one of {wall: {brightness}}, {lamps: {brightness}}, {lamps: {colorTemp}}, {fire: {on}}, {fire: {flame: true}}, {tv: {on}}' });
    } catch (error) {
      console.log(error);
      return reply(500, { error: error.message });
    }
    console.log(`${new Date().toISOString()} screen ${body}`);
    reply(200, screenState());
  });
}).listen(SCREEN_PORT, () => console.log(`screen requests on port ${SCREEN_PORT}`));
