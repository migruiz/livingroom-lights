const { Observable, merge, timer, interval } = require('rxjs');
const { mergeMap, withLatestFrom, map, share, shareReplay, filter, mapTo, take, debounceTime, throttle, throttleTime, startWith, takeWhile, delay, scan, distinct, distinctUntilChanged, tap, flatMap, takeUntil, toArray, groupBy } = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
global.mtqqLocalPath = 'mqtt://192.168.0.11';
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
  });
}

console.log(`Living Room lights current time ${DateTime.now()}`);


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

  const sensorStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d00056bad56', function (content) {
      if (content.occupancy) {
        subscriber.next(content)
      }
    });
  });



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
    mqttCluster.subscribeData('zigbee2mqtt/0x385cfbfffe05a8d8', function (content) {
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
      else if (action === 'brightness_step_down') return { type: "lightsDown", value: c.action_step_size }
      else if (action === 'brightness_step_up') return { type: "lightsUp", value: c.action_step_size }
      else if (action === 'color_temperature_step_up') return { type: "changeFirePlaceColor" }
      else if (action === 'color_temperature_step_down') return { type: "changeFirePlaceColor" }
    })
  )

  const combinedStream = merge(autoOnOffStream, masterButtonStream, sunRiseStream, sunSetStream).pipe(
    scan((acc, curr) => {
      if (curr.type === 'toggle') return {...acc, type: curr.type, masterState: !acc.masterState, lightsOn: !acc.masterState, brightness: 100, fireOn: !acc.masterState }
      if (curr.type === 'lightsDown') return { ...acc, type: curr.type, masterState: true, lightsOn: true, brightness: acc.brightness - curr.value < 2 ? 2 : acc.brightness - curr.value, fireOn: true }
      if (curr.type === 'lightsUp') return { ...acc, type: curr.type, masterState: true, lightsOn: true, brightness: acc.brightness + curr.value > 1000 ? 1000 : acc.brightness + curr.value, fireOn: true}
      if (curr.type === 'changeFirePlaceColor') return { ...acc, type: curr.type, masterState: true, lightsOn: true, fireOn: true, changeFirePlaceColorReqNumber: acc.changeFirePlaceColorReqNumber + 1 }
      if (curr.type === 'sunRise') return { ...acc, type: curr.type, masterState: false, lightsOn: false, fireOn: false }
      if (curr.type === 'sunSet') return { ...acc, type: curr.type, masterState: true }
      if (curr.type === 'auto') return { ...acc, type: acc.masterState ? curr.type : 'omit', lightsOn: curr.occupancy, fireOn: curr.occupancy }

    }, { type: 'init', masterState: false, lightsOn: false, brightness: 0, fireOn: false, changeFirePlaceColorReqNumber: 0 }),
    filter(e => e.type !== 'omit'),
    share()

  );

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
    throttleTime(400)
  )
  const fireOnStream = combinedStream.pipe(
    distinctUntilChanged((prev,curr) => {
     return prev.fireOn===curr.fireOn
    }),
    map(({fireOn}) => fireOn)
  )

  fireOnStream
  .subscribe(async m => {
    console.log(JSON.stringify(m));    
    if (m) {
      await execCommandAsync(FIRE_ON_IR_CODE);
    }
    else {
      await execCommandAsync(FIRE_OFF_IR_CODE);
    }
  })

  fireColorStream
    .subscribe(async m => {
      console.log(JSON.stringify(m));
      await execCommandAsync(FIRE_FLAME_CHANGE_IR_CODE);
    })

  lightsStream
    .subscribe(async m => {
      console.log(JSON.stringify(m));
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
  const ledControlStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x0c4314fffe935690', function (content) {
      //console.log(content);    
      subscriber.next(content)
    });
  });

  const ledControlStreamShared = ledControlStream.pipe(share())

  const onOffStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'toggle')
  )
  const onRotationStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'brightness_up_hold' || m.action === 'brightness_down_hold')
  )
  const onStopStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'brightness_up_release' || m.action === 'brightness_down_release')
  )
  const leftRightStream = onRotationStream.pipe(
    flatMap(m => interval(30).pipe(

      startWith(1),
      takeUntil(onStopStream),
      mapTo(m)
    )));


  const colorRotationStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'arrow_right_hold' || m.action === 'arrow_left_hold')
  )
  const colorStopStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'arrow_right_release' || m.action === 'arrow_left_release')
  )

  const singleStateStream = ledControlStreamShared.pipe(
    filter(m => m.action === 'arrow_left_click' || m.action === 'arrow_right_click' || m.action === 'brightness_down_click' || m.action === 'brightness_up_click')
  )

  const colorLeftRightStream = colorRotationStream.pipe(
    flatMap(m => interval(200).pipe(

      startWith(1),
      takeUntil(colorStopStream),
      mapTo(m)
    )));

  const brightnessActionStream = merge(leftRightStream, onOffStream, colorLeftRightStream, singleStateStream).pipe(
    scan((acc, curr) => {
      if (curr.action === 'brightness_up_hold') return { brigthnessValue: acc.brigthnessValue + 2 > 254 ? 254 : acc.brigthnessValue + 2, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'brightness_up_click') return { brigthnessValue: acc.brigthnessValue + 25 > 254 ? 254 : acc.brigthnessValue + 25, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'brightness_down_hold') return { brigthnessValue: acc.brigthnessValue - 2 < 2 ? 2 : acc.brigthnessValue - 2, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'brightness_down_click') return { brigthnessValue: acc.brigthnessValue - 25 < 2 ? 2 : acc.brigthnessValue - 25, colorTemp: acc.colorTemp, action: 'brigthness' }
      if (curr.action === 'arrow_right_hold') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp + 10 > 454 ? 454 : acc.colorTemp + 10, action: 'color' }
      if (curr.action === 'arrow_right_click') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp + 25 > 454 ? 454 : acc.colorTemp + 25, action: 'color' }
      if (curr.action === 'arrow_left_hold') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp - 10 < 250 ? 250 : acc.colorTemp - 10, action: 'color' }
      if (curr.action === 'arrow_left_click') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp - 25 < 250 ? 250 : acc.colorTemp - 25, action: 'color' }
      if (curr.action === 'toggle') return { brigthnessValue: acc.brigthnessValue, colorTemp: acc.colorTemp, action: 'toggle' }

    }, { brigthnessValue: 0, colorTemp: 0 }),
    share()
  )
  brightnessActionStream.subscribe(async m => {
    //console.log('Upstairs', m);
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

  })
})();


//fireplace control
(function () {



  const buttonControl = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x04cd15fffe58b077', function (content) {
      subscriber.next(content)
    });
  });

  buttonControl.pipe(
    filter(c => c.action === 'brightness_move_up')
  )
    .subscribe(async m => {
      (await mqtt.getClusterAsync()).publishMessage('livingroom/fire/state', 'on');
      await delay(1000);
      await execCommandAsync(FIRE_ON_IR_CODE);
      await delay(1000);
      await execCommandAsync(FIRE_ON_IR_CODE);
      await delay(1000);
      await execCommandAsync(FIRE_ON_IR_CODE);
    })


  buttonControl.pipe(
    filter(c => c.action === 'brightness_move_down')
  )
    .subscribe(async m => {
      await execCommandAsync(FIRE_OFF_IR_CODE);
      (await mqtt.getClusterAsync()).publishMessage('livingroom/fire/state', 'off');
    })


  buttonControl.pipe(
    filter(c => c.action === 'on')
  )
    .subscribe(async m => {
      await execCommandAsync(FIRE_FLAME_CHANGE_IR_CODE);
    })

})();



//master switch
(function () {
  const remoteStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x84ba20fffea45342', function (content) {
      subscriber.next(content)
    });
  });

  const onStream = remoteStream.pipe(
    filter(m => m.action === 'on')
  )
  const offStream = remoteStream.pipe(
    filter(m => m.action === 'brightness_move_up')
  )

  onStream.subscribe(async m => {
    (await mqtt.getClusterAsync()).publishMessage('livingroom/media/state', 'on');
    (await mqtt.getClusterAsync()).publishMessage('livingroom/fire/state', 'on');
  })
  offStream.subscribe(async m => {
    (await mqtt.getClusterAsync()).publishMessage('livingroom/media/state', 'off');
    (await mqtt.getClusterAsync()).publishMessage('livingroom/fire/state', 'off');
    (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', '0');
    (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed8947e/set', JSON.stringify({ brightness: 0 }));
    (await mqtt.getClusterAsync()).publishMessage('zigbee2mqtt/0x2c1165fffed897d3/set', JSON.stringify({ brightness: 0 }));
  })
})();






//auto function
(function () {
  return;
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

  const sensorStream = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d00056bad56', function (content) {
      if (content.occupancy) {
        subscriber.next(content)
      }
    });
  });



  const sharedSensorStream = sensorStream.pipe(
    share()
  )
  const turnOffStream = sharedSensorStream.pipe(
    debounceTime(3 * 60 * 1000),
    mapTo("off"),
    share()
  )

  const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    mapTo("on")
  )
  const autoOnOffStream = merge(turnOnStream, turnOffStream).pipe(
    map(e => ({ type: 'auto', actionState: e === 'on' }))
  )


  const buttonControl = new Observable(async subscriber => {
    var mqttCluster = await mqtt.getClusterAsync()
    mqttCluster.subscribeData('zigbee2mqtt/0x04cd15fffe58b077', function (content) {
      subscriber.next(content)
    });
  });


  const masterButtonStream = buttonControl.pipe(
    filter(c => c.action === 'off'),
    mapTo({ type: 'master' })
  )

  const combinedStream = merge(autoOnOffStream, masterButtonStream, sunRiseStream, sunSetStream).pipe(
    scan((acc, curr) => {
      if (curr.type === 'master') return { type: curr.type, masterState: !acc.masterState, actionState: !acc.masterState }
      if (curr.type === 'sunRise') return { type: curr.type, masterState: false, actionState: false }
      if (curr.type === 'sunSet') return { type: curr.type, masterState: true, actionState: acc.actionState }
      if (curr.type === 'auto') return { type: acc.masterState ? curr.type : 'omit', masterState: acc.masterState, actionState: curr.actionState }

    }, { masterState: false, actionState: false, type: 'init' }),
    filter(e => e.type !== 'omit')

  );



  combinedStream
    .subscribe(async m => {
      console.log(m);
      if (m.actionState) {
        await execCommandAsync(FIRE_ON_IR_CODE);
        (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', '20');
        (await mqtt.getClusterAsync()).publishMessage('livingroom/fire/state', 'on');
        await delay(1000);
        await execCommandAsync(FIRE_ON_IR_CODE);
        await delay(1000);
        await execCommandAsync(FIRE_ON_IR_CODE);
        await delay(1000);
        await execCommandAsync(FIRE_ON_IR_CODE);
      }
      else {
        (await mqtt.getClusterAsync()).publishMessage('livingroom/wall/light', '0');
        await execCommandAsync(FIRE_OFF_IR_CODE);
      }
    })



})();