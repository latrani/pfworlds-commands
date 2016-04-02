'use strict';

// General stuff
var capitalize = require('string-capitalize');
var _ = require('underscore');

// HTTP setup
var http = require('http');
var dispatcher = require('httpdispatcher');

var express = require('express');
var bodyParser = require('body-parser');

const INFO_PROPS = {
  species: 'Phenotypic representation',
  gender: 'Whatever you say it is',
};

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

var datastore = require('./redis-store.js');

app.post('/ooc', (req, res) => {
  res.json({
    response_type: 'in_channel',
    text: '*[OOC]* ' + req.body.text
  });
});

app.post('/look', (req, res) => {
  datastore.setWorld(req.body.team_domain);

  let result;

  if (_.isEmpty(req.body.text)) {
    result = datastore.channel.get(req.body.channel_id)
    .then(function(channelProps){
      if(_.isEmpty(channelProps) || !channelProps.desc) {
        return 'No desc found for this room';
      } else {
        return channelProps.desc;
      }
    });
  } else {
    result = datastore.user.get(req.body.text)
    .then(function(userProps){
      if(_.isEmpty(userProps) || !userProps.desc) {
        return 'No desc found for ' + req.body.text;
      } else {
        return userProps.desc;
      }
    });
  }

  result.then((text) => {
    res.json({
      response_type: 'ephemeral',
      text: text
    });
  });

});

app.post('/setdesc', (req, res) => {
  datastore.setWorld(req.body.team_domain);

  datastore.user.update(req.body.user_name, 'desc', req.body.text).then(function(){
    res.json({
      response_type: 'ephemeral',
      text: 'Description set.'
    });
  });
});

app.post('/setroomdesc', (req, res) => {
  datastore.setWorld(req.body.team_domain);

  datastore.channel.update(req.body.channel_id, 'desc', req.body.text).then(function(){
    res.json({
      response_type: 'ephemeral',
      text: 'Channel description set.'
    });
  });
});

app.post('/info', (req, res) => {
  datastore.setWorld(req.body.team_domain);

  let result = Promise.resolve();
  const tokens = req.body.text.split(' ');
  const currentUser = req.body.user_name;
  const command = _.first(tokens).toLowerCase();
  const args = _.rest(tokens);

  switch (command) {
    case '': //Falls through
    case 'help':
      result = Promise.resolve('#### Datasphere Help\n' +
      '* `[@username]`: Show info for someone, by @username (Tab-completion works here!)\n' +
      '* `list`: List available fields\n' +
      '* `set [field] [value]`: Set a field on yourself\n' +
      '* `help`: This message\n');
      break;
    case 'list':
      let text = '#### Avaliable datasphere info fields:\n';

      _.each(INFO_PROPS, function(value, key) {
        text += '* *' + capitalize(key) + '*: ' + value + '\n';
      });

      text += '\nUse `/info set [field] [value]` to set yours!\n';
      text += 'All fields may be formatted using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)\n';

      result = Promise.resolve(text);
      break;
    case 'set':
      var key = _.first(args).toLowerCase();
      var value = _.rest(args).join(' ');

      if (_.has(INFO_PROPS, key)) {
        result =  datastore.user.update(currentUser, key, value).then(function(response){
          return '`' + key + '` has been set to `' + value + '`';
        });
      } else {
        result = Promise.resolve('`' + key + '` is not a recognized property!');
      }
      break;
    default: // Assume arg is a user, try to fetch their info
      result = datastore.user.get(command).then(function(theResponse) {
        let text;
        // Filter the response to only the info properties
        const response = _.pick(theResponse, _.keys(INFO_PROPS));
        if (!_.isEmpty(response)) {
          text = '#### Datasphere record for `' + command + '`:\n';
          _.each(INFO_PROPS, function(value, key) {
            var userValue = response[key] || '(unset)';
            text += '* *' + capitalize(key) + '*: ' + userValue + '\n';
          });
        }
        else {
          text = 'No info found for `' + command + '`\n';
        }

        return text;
      });
    // end switch
  }

  result.then((text) => {
    res.json({
      response_type: 'ephemeral',
      text: text
    });
  });

});

app.listen(8080, function () {
  console.log('World commands app listening on port 8080!');
});

module.exports = app;
