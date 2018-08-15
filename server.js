// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var ejs = require('ejs');

var Twitter = require('twitter');

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

function parse_tweet_id(tweet_url){
  var re = /\/(\d+)/g;
  var tweet_id = re.exec(tweet_url);
  return tweet_id[0].replace(/\//g,'');
}

function eval_report(report){
  if (typeof report != 'undefined'){
    return true;
  } else {
    return false;
  }
}

// fetches every single user who retweeted the tweet and blocks them
function fetch_retweeters(client, tweet_id, report=false, cursor=null){
   var api_call = 'statuses/retweeters/ids.json?'
    + 'id=' + tweet_id
    + '&stringify_ids=true';
  if (cursor){
    api_call += '&cursor='+ cursor;
  }
  client.get(
    api_call, 
    function(error, response) {
      if(error) throw error;
      var ids = response['ids'];
      var next_cursor = response['next_cursor_str'];
      ids.forEach((id) => {
        if (report){
          report_and_block(client, id);
        } else {
          block(client, id);
        }
      });
      if (response['next_cursor'] !== 0) fetch_retweeters(client, tweet_id, report, cursor);
  });
}

function report_and_block(client, user_id){
  var api_call = '/users/report_spam.json?'
    + 'user_id=' + user_id
    + '&perform_block=true';
  client.post(
    api_call,
    function(errors, response) {
        if (errors) {
          errors.forEach( (error) => {
          console.log(error['message']);
        }
        );
      } else {
        console.log('user ' + user_id + ' has been blocked!');
      }
    })
}


function block(client, user_id){
  var api_call = 'blocks/create.json?'
    + 'user_id=' + user_id;
  client.post(
    api_call,
    function(errors, response) {
      if (errors) {
        errors.forEach( (error) => {
          console.log(error['message']);
        }
        );
      } else {
        console.log('user ' + user_id + ' has been blocked!');
      }
    })
}


// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});


app.post('/block', function(request, response) {
  var tweet_id =  parse_tweet_id(request.body.tweet_url);
  var tweet_url = request.body.tweet_url;
  var report = eval_report(request.body.report);
  //Starts twitter and authenticates
  var client = new Twitter({
    consumer_key: request.body.consumer_key,
    consumer_secret: request.body.consumer_secret,
    access_token_key: request.body.access_token,
    access_token_secret: request.body.access_token_secret
  });
  fetch_retweeters(client, tweet_id, report);
  client = null;
  ejs.renderFile(__dirname + '/views/block.ejs', 
                 {tweet_url: tweet_url},
                 function(err, str){
                  response.send(str);
                });
}); 

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
