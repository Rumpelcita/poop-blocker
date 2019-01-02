// server.js
// where your node app starts

// init project
var express = require('express');
var OAuth = require('oauth');

var app = express();

// fill with keys provided by Twitter
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
// enable this through twitter's app management panel
const CALLBACK_RESOURCE = '/access-token';
const CALLBACK_URL = 'https://poop-blocker.glitch.me' + CALLBACK_RESOURCE;

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var ejs = require('ejs');

var Twitter = require('twitter');

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

function parse_tweet_id(tweet_url) {
  var re = /\/(\d+)/g;
  var tweet_id = re.exec(tweet_url);
  return tweet_id[0].replace(/\//g,'');
}

function eval_report(report){
  if (typeof report != 'undefined') {
    return true;
  } else {
    return false;
  }
}

// fetches every single user who retweeted the tweet and blocks them
function fetch_retweeters(client, tweet_id, report=false, cursor=null){
  client.get(
    'statuses/retweeters/ids.json',
    {id: tweet_id, stringify_ids: true, cursor: cursor},
    function(error, response) {
      if(error)
        throw error;
      var ids = response['ids'];
      var next_cursor = response['next_cursor_str'];
      ids.forEach((id) => {
        if (report){
          report_and_block(client, id);
        } else {
          block(client, id);
        }
      });
      if (response['next_cursor'] !== 0)
        fetch_retweeters(client, tweet_id, report, cursor);
    }
  );
}

function report_and_block(client, user_id) {
  client.post(
    'users/report_spam.json',
    {user_id: user_id, perform_block: true},
    function(errors, response) {
      if (errors) {
        errors.forEach((error) => {
          console.log(error['message']);
        });
      }
      else {
        console.log('user ' + user_id + ' has been blocked!');
      }
    }
  );
}

function block(client, user_id){
  client.post(
    'blocks/create.json',
    {user_id: user_id},
    function(errors, response) {
      if (errors) {
        errors.forEach((error) => {
          console.log(error['message']);
        });
      } else {
        console.log('user ' + user_id + ' has been blocked!');
      }
    }
  );
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
    }
  );
});

function get_twitter_oauth(tweet_url) {
  return new OAuth.OAuth(
    'https://api.twitter.com/oauth/request_token',
    'https://api.twitter.com/oauth/access_token',
    CONSUMER_KEY,
    CONSUMER_SECRET,
    '1.0A',
    CALLBACK_URL + '?tweet_url=' + encodeURIComponent(tweet_url),
    'HMAC-SHA1'
  );
}

app.post('/request-token', function(request, response) {
  var client = new Twitter({
    consumer_key: CONSUMER_KEY,
    consumer_secret: CONSUMER_SECRET,
  });
  var tweet_url = request.body.tweet_url;
  // request an unauthorized Request Token from twitter (OAuth1.0 - 6.1)
  var oa = get_twitter_oauth(tweet_url);
  oa.getOAuthRequestToken(function(error, request_token, request_secret, results) {
    if (!error) {
      // send the user to authorize the Request Token (OAuth1.0 - 6.2)
      response.redirect('https://api.twitter.com/oauth/authorize?oauth_token='+request_token);
    }
    else {
      response.send(error);
    }
  });
});

app.get(CALLBACK_RESOURCE, function(request, response) {
  // get the authorized Request Token from the GET parameters
  var request_token = request.query.oauth_token;
  var oauth_verifier = request.query.oauth_verifier;
  var tweet_url = request.query.tweet_url;
  var tweet_id = parse_tweet_id(tweet_url);
  var report = eval_report(request.body.reportauth);

  var oa = get_twitter_oauth(tweet_url);
  // exchange the authorized Request Token for an Access Token (OAuth1.0 - 6.3)
  oa.getOAuthAccessToken(request_token, null, oauth_verifier, function(error, access_token, access_token_secret, results) {
    if (!error) {
      var client = new Twitter({
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET,
        access_token_key: access_token,
        access_token_secret: access_token_secret
      });
      try {
        fetch_retweeters(client, tweet_id, report);
      }
      catch (error) {
        response.send(error);
        return;
      }
      client = null;

      ejs.renderFile(__dirname + '/views/block.ejs', 
        {tweet_url: tweet_url},
        function(err, str) { response.send(str); }
      );
    }
    else {
      response.send(error);
    }
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
