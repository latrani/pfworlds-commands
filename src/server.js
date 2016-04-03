'use strict';

// General stuff
const capitalize = require('string-capitalize');
const _ = require('underscore');

// HTTP setup
const http = require('http');
const dispatcher = require('httpdispatcher');

const express = require('express');
const bodyParser = require('body-parser');

const INFO_PROPS = {
  species: 'Phenotypic representation',
  gender: 'Whatever you say it is',
};

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const datastore = require('./redis-store.js');

const handleCommand = function(command, responseType, handlerPromise) {
  app.post('/' + command, (req, res) => {
    datastore.setWorld(req.body.team_domain);
    handlerPromise(req.body).then(text => {
      res.json({
        response_type: responseType,
        text: text
      });
    });
  });
};

handleCommand('ooc', 'in_channel', params => {
  return Promise.resolve('*[OOC]* ' + params.text);
});

handleCommand('look', 'ephemeral', params => {
  if (_.isEmpty(params.text)) {
    return datastore.channel.get(params.channel_id)
    .then(channelProps => {
      if(_.isEmpty(channelProps) || !channelProps.desc) {
        return 'No desc found for this room';
      } else {
        return channelProps.desc;
      }
    });
  } else {
    return datastore.user.get(params.text)
    .then(userProps => {
      if(_.isEmpty(userProps) || !userProps.desc) {
        return 'No desc found for ' + params.text;
      } else {
        return userProps.desc;
      }
    });
  }
});

handleCommand('setdesc', 'ephemeral', params => {
  return datastore.user.update(params.user_name, 'desc', params.text).then(() => {
    return 'Description set.';
  });
});

handleCommand('setroomdesc', 'ephemeral', params => {
  return datastore.channel.update(params.channel_id, 'desc', params.text).then(() => {
    return 'Channel description set.';
  });
});

handleCommand('info', 'ephemeral', params => {
  const tokens = params.text.split(' ');

  const command = _.first(tokens).toLowerCase();
  const args = _.rest(tokens);

  switch (command) {
    case '': //Falls through
    case 'help':
      return Promise.resolve('#### Datasphere Help\n' +
      '* `[@username]`: Show info for someone, by @username (Tab-completion works here!)\n' +
      '* `list`: List available fields\n' +
      '* `set [field] [value]`: Set a field on yourself\n' +
      '* `help`: This message\n');
    case 'list':
      let text = '#### Avaliable datasphere info fields:\n';

      _.each(INFO_PROPS, (value, key) => {
        text += '* *' + capitalize(key) + '*: ' + value + '\n';
      });

      text += '\nUse `/info set [field] [value]` to set yours!\n';
      text += 'All fields may be formatted using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)\n';

      return Promise.resolve(text);
    case 'set':
      const key = _.first(args).toLowerCase();
      const value = _.rest(args).join(' ');

      return _.has(INFO_PROPS, key) ?
        datastore.user.update(params.user_name, key, value).then(response => {
          return '`' + key + '` has been set to `' + value + '`';
        }) :
        Promise.resolve('`' + key + '` is not a recognized property!');
      // end case
    default: // Assume arg is a user, try to fetch their info
      return datastore.user.get(command).then(theResponse => {
        let text;
        // Filter the response to only the info properties
        const response = _.pick(theResponse, _.keys(INFO_PROPS));
        if (!_.isEmpty(response)) {
          text = '#### Datasphere record for `' + command + '`:\n';
          _.each(INFO_PROPS, (value, key) => {
            const userValue = response[key] || '(unset)';
            text += '* *' + capitalize(key) + '*: ' + userValue + '\n';
          });
        } else {
          text = 'No info found for `' + command + '`\n';
        }

        return text;
      });
    // end switch
  }
});

handleCommand('archive', 'ephemeral', params => {
  return datastore.user.get(params.user_name).then(response => {
    return 'Character data archive:\n' +
    '```\n' +
    JSON.stringify(response) + '\n' +
    '```\n';
  });
});

handleCommand('unarchive', 'ephemeral', params => {
  let archive;
  try {
    archive = JSON.parse(params.text);
  } catch (err) {
    return Promise.resolve('That doesn\'t look like a valid character archive!');
  }
  return datastore.user.set(params.user_name, archive).then(response => {
    return 'Character archive successfully applied.';
  });
});

app.listen(8080, () => {
  console.log('World commands app listening on port 8080!');
});

module.exports = app;
