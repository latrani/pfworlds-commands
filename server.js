'use strict';

// General stuff
var capitalize = require('string-capitalize');
var _ = require('underscore');

// HTTP setup
var http = require('http');
var dispatcher = require('httpdispatcher');

// Redis setup
var redis = require('redis');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
var redisClient = redis.createClient();

//Lets define a port we want to listen to
var PORT = 8080;

function handleRequest(request, response){
  try {
    dispatcher.dispatch(request, response);
  } catch(err) {
    console.log(err);
  }
}

//Create a server
var server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function(){
  //Callback triggered when server is successfully listening. Hurray!
  console.log('Server listening on: http://localhost:%s', PORT);
});

dispatcher.onPost('/ooc', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.end(JSON.stringify({
    response_type: 'in_channel',
    text: '*[OOC]* ' + req.params.text
  }));
});

dispatcher.onPost('/info', function(req, res) {
  var infoProps = {
    species: 'Phenotypic representation',
    gender: 'Whatever you say it is',
    // desc: 'What do you look like?',
    // prefs: 'What are you into?'
  };

  var textReq = req.params.text;
  var currentUser = req.params.user_name;
  var currentWorld = req.params.team_domain;

  var tokens = textReq.split(' ');
  console.log('Command: info, arguments: ' + textReq);

  var command = tokens[0];
  res.writeHead(200, {'Content-Type': 'text/json'});

  // Closure to send resposne
  var send = function(text) {
    res.end(JSON.stringify({
      response_type: 'ephemeral',
      text: text
    }));
  };

  switch (command) {
    case 'list':
      var textResponse = '#### Avaliable datasphere info fields:\n';

      _.each(infoProps, function(value, key) {
        textResponse += '* *' + capitalize(key) + '*: ' + value + '\n';
      });

      textResponse += '\nUse `/info set [field] [value]` to set yours!\n';
      textResponse += 'All fields may be formatted using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)\n';
      send(textResponse);
      break;
    case '':
    case 'help':
      textResponse = '#### Datasphere Help\n' +
      '* `[@username]`: Show info for someone, by @username (Tab-completion works here!)\n' +
      '* `list`: List available fields\n' +
      '* `set [field] [value]`: Set a field on yourself\n' +
      '* `help`: This message\n';
      send(textResponse);
      break;
    case 'set':
      var userKeys = {};
      var property = tokens[1].toLowerCase();
      var value = tokens.slice(2).join(' ');

      redisClient.getAsync(currentWorld + ':' + currentUser).then(function(response) {
        if (response) {
          try {
            userKeys = JSON.parse(response);
          } catch(err) {
            console.warn('userKeys parsing failed: ' + err);
          }
        }
        if (_.has(infoProps, property)) {
          userKeys[property] = value;
          redisClient.setAsync(currentWorld + ':' + currentUser, JSON.stringify(userKeys)).then(function(){
            send('`' + property + '` has been set to `' + value + '`');
          });
        } else {
          send('`' + property + '` is not a recognized property!');
        }
      });
      break;
    default:
      // Fetch user info
      var username = command.toLowerCase().replace('@', ''); // Strip leading at sign if it's there.
      redisClient.getAsync(currentWorld + ':' + username).then(function(response) {
        var textResponse;
        if (response) {
          var userData = JSON.parse(response);
          textResponse = '#### Datasphere record for `@' + username + '`:\n';
          _.each(infoProps, function(value, key) {
            var userValue = userData[key] || '(unset)';
            textResponse += '* *' + capitalize(key) + '*: ' + userValue + '\n';
          });
        }
        else {
          textResponse = 'No info found for `@' + username + '`';
        }

        send(textResponse);
      });
  }
});
