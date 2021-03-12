const http = require('http');
const axios = require('axios')
const fs = require('fs');
const util = require('util');
const uuidv4 = require('uuid/v4')
const rimraf = require("rimraf");
const readFileAsync = util.promisify(fs.readFile);
const mappings = JSON.parse(process.env.MAPPINGS)
const { execSync} = require('./execSync');


http.createServer((request, response) => {
  const { headers, method, url } = request;
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', async () => {
    body = Buffer.concat(body).toString();

    const hookInfo = JSON.parse(body)

    console.log("hookInfo.repository.full_name: ",hookInfo.repository.full_name)
    const mappingQuery =  mappings.filter(r => r.gitRepoFullName===hookInfo.repository.full_name)
    if (mappingQuery.length==0){
      response.end();
      return
    }

    const mappingNodeInfo = mappingQuery[0];
    const sessionFolderId = uuidv4()
    await execGit2SVNSync(mappingNodeInfo, hookInfo,sessionFolderId);
    const svnRevisionNo = await readFileAsync(`/${sessionFolderId}/target_folder/svnRevision.txt`,'utf-8')
    rimraf.sync(`/${sessionFolderId}`);
    console.log(`svnNo: ${svnRevisionNo}`)

    if (!mappingNodeInfo.jenkins){
      response.end();
      return
    }
    
    console.log(`hookInfo ref: ${hookInfo.ref}`)
    const targetJenkinsJobQuery = mappingNodeInfo.jenkins.filter(r => r.branchRef===hookInfo.ref)
    console.log(`Target jenkins job: ${targetJenkinsJobQuery}`)
    if (targetJenkinsJobQuery.length==0){
      response.end();
      return
    }
    const targetJenkinsJob = targetJenkinsJobQuery[0];
    
    const urlWithParameters=`${targetJenkinsJob.jenkinsURL}&SVN_REVISION_NO=${svnRevisionNo}`
    console.log("posting: ",urlWithParameters)
    await axios.post(urlWithParameters);
    response.end();
  });
}).listen(80);

async function execGit2SVNSync(mappingNodeInfo, hookInfo,sessionFolderId) {
  const gitBranchName = hookInfo.ref.replace('refs/heads/','')
  const svnTargetPath = process.env.SVN_BASEURL + mappingNodeInfo.svnPath;
  let svnTargetURL = '';
  if (gitBranchName === 'master') {
    svnTargetURL = svnTargetPath + 'trunk';
    if(mappingNodeInfo.svnTrunkException){
      svnTargetURL += mappingNodeInfo.svnTrunkException;
    }
  }
  else {
    svnTargetURL = svnTargetPath + 'branches/' + gitBranchName;
  }
  const gitUrl = process.env.GIT_SERVER + hookInfo.repository.full_name + '.git';
  console.log("svnTargetURL: ",svnTargetURL)
  console.log("gitUrl: ",gitUrl)
  console.log("gitBranchName: ",gitBranchName)
  await execSync(gitUrl, gitBranchName, svnTargetURL,sessionFolderId);
}

