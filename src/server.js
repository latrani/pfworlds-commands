'use strict';

// General stuff
var capitalize = require('string-capitalize');
var _ = require('underscore');

// HTTP setup
var http = require('http');
var dispatcher = require('httpdispatcher');

var datastore = require('./redis-store.js');

//Lets define a port we want to listen to
var PORT = 8080;

var handleRequest = function(request, response){
  try {
    dispatcher.dispatch(request, response);
  } catch(err) {
    console.log(err);
  }
};

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

dispatcher.onPost('/setdesc', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/json'});
  datastore.setWorld(req.params.team_domain);
  var send = function(text) {
    res.end(JSON.stringify({
      response_type: 'ephemeral',
      text: text
    }));
  };

  var currentUser = req.params.user_name;

  datastore.user.update(currentUser, 'desc', req.params.text).then(function(){
    send('Description set.');
  });
});

dispatcher.onPost('/setroomdesc', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/json'});
  datastore.setWorld(req.params.team_domain);
  var send = function(text) {
    res.end(JSON.stringify({
      response_type: 'ephemeral',
      text: text
    }));
  };

  var currentUser = req.params.user_name;

  datastore.channel.update(req.params.channel_id, 'desc', req.params.text).then(function(){
    send('Channel description set.');
  });
});

dispatcher.onPost('/look', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/json'});
  datastore.setWorld(req.params.team_domain);

  var send = function(text) {
    res.end(JSON.stringify({
      response_type: 'ephemeral',
      text: text
    }));
  };

  if (_.isEmpty(req.params.text)) {
    datastore.channel.get(req.params.channel_id).then(function(channelProps){
      if(_.isEmpty(channelProps) || !channelProps.desc) {
        send('No desc found for this room');
      } else {
        send(channelProps.desc);
      }
    });
  }

  datastore.user.get(req.params.text).then(function(userProps){
    if(_.isEmpty(userProps) || !userProps.desc) {
      send('No desc found for ' + req.params.text);
    } else {
      send(userProps.desc);
    }
  });
});

dispatcher.onPost('/info', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/json'});
  datastore.setWorld(req.params.team_domain);

  var infoProps = {
    species: 'Phenotypic representation',
    gender: 'Whatever you say it is',
    // desc: 'What do you look like?',
    // prefs: 'What are you into?'
  };

  var textReq = req.params.text;
  var currentUser = req.params.user_name;

  var tokens = textReq.split(' ');

  var command = tokens[0];

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
      var key = tokens[1].toLowerCase();
      var value = tokens.slice(2).join(' ');

      if (_.has(infoProps, key)) {
        datastore.user.update(currentUser, key, value).then(function(response){
          send('`' + key + '` has been set to `' + value + '`');
        });
      } else {
        send('`' + key + '` is not a recognized property!');
      }
      break;
    default:
      // Fetch user info
      var username = command.toLowerCase(); // Strip leading at sign if it's there.
      datastore.user.get(username).then(function(response) {
        var textResponse;
        response = _.pick(response, _.keys(infoProps));
        if (!_.isEmpty(response)) {
          textResponse = '#### Datasphere record for `' + username + '`:\n';
          _.each(infoProps, function(value, key) {
            var userValue = response[key] || '(unset)';
            textResponse += '* *' + capitalize(key) + '*: ' + userValue + '\n';
          });
        }
        else {
          textResponse = 'No info found for `' + username + '`\n';
        }

        send(textResponse);
      });
  }
});