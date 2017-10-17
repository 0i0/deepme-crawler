var fs            = require('fs')
  , util          = require('util')

const jsdom  = require("jsdom")
const { JSDOM } = jsdom

var minStars = 10
   ,crawlInterval = 3000

// fs.mkdirSync('crawled.users', 0744);
// fs.mkdirSync('seeds.users', 0744);
// fs.mkdirSync('crawled.repos', 0744);
// fs.mkdirSync('seeds.repos', 0744);
// fs.mkdirSync('db', 0744);
function getDate(){
var currentdate = new Date(); 
var datetime =    currentdate.getDate() + "/"
                + (currentdate.getMonth()+1)  + "/" 
                + currentdate.getFullYear() + " @ "  
                + currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds();
return datetime
}

function crawlUser(user,cb){
  var repos = []
  var url = 'https://github.com/'+user+'?tab=stars'
  JSDOM.fromURL(url, {})
    .then( dom => {
      var starsElements = dom.window.document.querySelectorAll("a.muted-link.mr-3")
      var regex = /(<([^>]+)>)/ig
      for (var i = 0; i < starsElements.length ; i++) {
        var repoLink = starsElements[i].href
        if(repoLink.includes('stargazers')){
          var satrsNumber = Number(starsElements[i].innerHTML.replace(regex, '').replace(',',''))
          repos.push({
            repo:repoLink.replace('/stargazers','').replace('https://github.com/',''),
            stars:satrsNumber,

          }) 
        }

      }
      return repos
    })
    .then(repos => {
      for (var i = repos.length - 1; i >= 0; i--) {
        if(repos[i].stars>minStars && repos[i].repo.split('/')[0]!=user){
          checkifRepoWasCrawled(repos[i],function(repo,isCrawled){
            if(isCrawled)
              return
            addRepoAsSeed(repo.repo)
            repoToDB(repo)
            setTimeout(function(){
              crawlRepo(repo.repo,function(){
                removeRepoFromSeed(repo)
                logRepo(repo)
              })
            },i*crawlInterval)
            
          })
        }
      }
      cb(user)
    })
    .catch(function(e) {
      console.log(e)
    });
    
}

function crawlRepo(repo,cb){
  var users = []
  var url = 'https://github.com/'+repo+'/stargazers'
  JSDOM.fromURL(url, {})
    .then( dom => {
      var userElements = dom.window.document.querySelectorAll('.follower-list-align-top.d-inline-block.ml-3 h3 span a')
      for(i=0;i<userElements.length;i++){
         users.push(userElements[i].href.replace('https://github.com/',''))
      }
      return users
    })
    .then(users => {
      for (var i = users.length - 1; i >= 0; i--) {
        if(users[i] != repo.split('/')[0]){
          checkifUserWasCrawled(users[i],function(user,isCrawled){
            if(isCrawled)
              return
            addUserAsSeed(user)
            setTimeout(function(){
              crawlUser(user,function(){
                removeUsersFromSeed(user)
                logUser(user)
              })
            },crawlInterval*i)

          })
        }
      }
      cb(repo) 
    })
    .catch(function(e) {
      console.log(e)
    });
}
function addUserAsSeed(user){
  var filename = __dirname + '/seeds.users/'+user.substring(0,1)+'.txt'
  if (!fs.existsSync(filename))
    fs.writeFileSync(filename,'')
  fs.appendFileSync(filename,user+'\n');
}
function addRepoAsSeed(repo){
  var filename = __dirname + '/seeds.repos/'+repo.substring(0,1)+'.txt'
  if (!fs.existsSync(filename))
    fs.writeFileSync(filename,'')
  fs.appendFileSync(filename,repo+'\n');
}
function checkifUserWasCrawled(user,cb){
  var filename = __dirname + '/crawled.users/'+user.substring(0,1)+'.txt'
  return fs.readFile(filename, 'utf8', function (err,data) {
    if (err) {
      cb(user,false)
    }else{
      console.log(getDate()+(data.indexOf(user) >= 0)+':isCrawled :'+user+':')
      cb(user,data.indexOf(user) >= 0)
    }
  });
}
function removeUsersFromSeed(user){
  var filename = __dirname + '/seeds.users/'+user.substring(0,1)+'.txt'
  fs.readFile(filename,'utf8', function read(err, data) {
    if (err) {
         return console.log(getDate()+'trying to remove file which doesnt exist yet:'+filename)
    }
    
    var lines = data.split('\n')
    for (var i = lines.length - 1; i >= 0; i--) {
      if(lines[i].indexOf(user) >= 0){
        lines.splice(i,1)
        console.log('removeing '+user+'from seed')
      }
    }
    lines.join('\n');
    fs.writeFileSync(filename, lines);
  })
}

function logRepo(repo){
  var filename = __dirname + '/crawled.repos/'+repo.repo.substring(0,1)+'.txt'
  console.log(getDate()+'add repo as craweld:'+repo.repo)
  if (!fs.existsSync(filename))
    fs.writeFileSync(filename,'')
  fs.readFile(filename,'utf8', function read(err, data) {
    if (data.indexOf(repo.repo)<0)
      fs.appendFileSync(filename,repo.repo+'\n');
  })  
}
function repoToDB(repo){
  var db = __dirname + '/db/db.'+repo.repo.substring(0,1)+'.csv'
  console.log(getDate()+'::::::::::::::::::::::::DB::::add repo to db:'+repo.repo)
  if (!fs.existsSync(db))
    fs.writeFileSync(db,'')
  fs.readFile(db,'utf8', function read(err, data) {
    if (data.indexOf(repo.repo)<0) 
      fs.appendFileSync(db,util.format('%s,%s\n',repo.stars,repo.repo));
  })
  //https://raw.githubusercontent.com/%s/master/README.md
}
function checkifRepoWasCrawled(repo,cb){
  var filename = __dirname + '/crawled.repos/'+repo.repo.substring(0,1)+'.txt'
  return fs.readFile(filename, 'utf8', function (err,data) {
    if (err) {
      console.log(getDate()+'created repo file:'+filename)
      console.log(getDate()+'not crawled :'+repo.repo)
      cb(repo,false)
    }else{
      console.log(getDate()+(data.indexOf(repo.repo) >= 0)+' isCrawled :'+repo.repo+':')
      cb(repo,data.indexOf(repo.repo) >= 0)
    }
  });
}
function removeRepoFromSeed(repo){
  var filename = __dirname + '/seeds.repos/'+repo.repo.substring(0,1)+'.txt'
  fs.readFile(filename,'utf8', function read(err, data) {
    if (err) {
       return console.log(getDate()+'trying to remove file which doesnt exist yet:'+filename)
    } 
    var lines = data.split('\n')
    for (var i = lines.length - 1; i >= 0; i--) {
      if(lines[i].indexOf(repo.repo) >= 0){
        lines.splice(i,1)
        console.log(getDate()+'removeing '+repo.repo+'from seed')
      }
    }
    lines.join('\n');
    fs.writeFileSync(filename, lines);
  })
}
function logUser(user){
  var filename = __dirname + '/crawled.users/'+user.substring(0,1)+'.txt'
  console.log(getDate()+'add user as craweld:'+user)
  if (!fs.existsSync(filename))
    fs.writeFileSync(filename,'')
  fs.readFile(filename,'utf8', function read(err, data) {
    if (data.indexOf(user)<0)
      fs.appendFileSync(filename,user+'\n')
  })
}


function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 1; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

console.log(makeid());
function readSomeSeed(){
  var filename = __dirname + '/seeds.repos/'+makeid()+'.txt'
  fs.readFile(filename,'utf8', function read(err, data) {
    if(err)
      console.log(err)
    var after = data.split('\n')
    console.log(after)
    var seed = after[0].split(',')[0]
    crawlRepo(seed,function(){
      removeRepoFromSeed(repoSeed)
      logRepo(repoSeed)
    })
  })
}

var filename = __dirname + '/restarts.txt'
if (!fs.existsSync(filename))
    fs.writeFileSync(filename,'')
 fs.appendFileSync(filename,getDate()+'\n')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('##############staeting server from new seed ###############################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
console.log('###########################################################################################')
setTimeout(readSomeSeed,10000);