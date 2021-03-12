'use strict';
var spawn = require('child_process').spawn;

const  execSyncFx = async (gitUrl,gitBranch,targetSVNUrl,sessionFolderId) => {   

  return new Promise(function (resolve, reject) {
          var process = spawn('/syncToSVN.sh'
          , [
                gitUrl
              , gitBranch
              , targetSVNUrl
              , sessionFolderId
          ]);
          var result = '';
          process.stdout.on('data', (data) => {
              result += data.toString();
          });
          var errorResult = '';
          process.stderr.on('data', (data) => {
            errorResult += data.toString();
          });
          process.on('exit', function (code, signal) {
            if (code) {
              console.log('error');
              const jsonError = JSON.stringify({code,signal,result,errorResult})
              console.log(jsonError)
              reject(jsonError)
              
            } else if (signal) {
              console.log('error');
              const jsonError = JSON.stringify({code,signal,result,errorResult})
              console.log(jsonError)
              reject(jsonError)
            } else {
              resolve()
            }        
          });    
        })
};


exports.execSync = execSyncFx