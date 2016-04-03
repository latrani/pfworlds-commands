"use strict";

const chai = require('chai');
const _ = require('underscore');
const rp = require('request-promise');
const qs = require('qs');
const http = require('http');
const expect = require('chai').expect;
const exec = require('child_process').exec;

const requestHandler = require('../src/server.js');

const reqTemplate = {
  channel_id: 'dummy-channel_id',
  channel_name: 'dummy-channel_name',
  response_url: 'dummy-response_url',
  team_domain: 'dummy-team_domain',
  team_id: 'dummy-team_id',
  token: 'dummy-token',
  user_id: 'dummy-user_id',
  user_name: 'dummy-user_name'
};

var baseURL;

var doCommand = function(theCommand) {
  const tokens = theCommand.split(' ');
  const command = _.first(tokens);
  const argument = _.rest(tokens).join(' ');

  const requestBody = _.extend({}, reqTemplate, {
    command: command,
    text: argument
  });

  return rp.post({
    url: baseURL + command,
    form: requestBody
  }).then(response => {
    const jsonResponse = JSON.parse(response);
    return jsonResponse;
  });
};

describe('Server', () => {
  var server;
  before(() => {
    exec('redis-cli flushdb');
    server = http.createServer(requestHandler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseURL = `http://${address.address}:${address.port}/`;
      console.log(baseURL);
    });
  });

  it('should have an OOC command', () => {
    return doCommand('ooc Test test test').then(response => {
      expect(response).to.deep.equal({
        response_type: 'in_channel',
        text: '*[OOC]* Test test test'
      });
    });
  });

  describe('User descriptions', () => {
    const userName = reqTemplate.user_name;
    it('should initially show an unset user desc message', () => {
      return doCommand('look ' + userName).then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'No desc found for ' + userName
        });
      });
    });

    it('should successfully set a description', () => {
      const descriptionText = 'This is my new description';
      return doCommand('setdesc ' + descriptionText)
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Description set.'
        });
      })
      .then(() => { return doCommand('look ' + userName); })
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: descriptionText
        });
      });
    });
  });

  describe('Channel descriptions', () => {
    const channelId = reqTemplate.channel_id;
    it('should initially show an unset channel desc message', () => {
      return doCommand('look').then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'No desc found for this room'
        });
      });
    });

    it('should successfully set a description', () => {
      const descriptionText = 'This is the new room description';
      return doCommand('setroomdesc ' + descriptionText)
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Channel description set.'
        });
      })
      .then(() => { return doCommand('look'); })
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: descriptionText
        });
      });
    });
  });

  describe('User info', () => {
    describe('help text', () => {
      const helpText =
      '#### Datasphere Help\n' +
      '* `[@username]`: Show info for someone, by @username (Tab-completion works here!)\n' +
      '* `list`: List available fields\n' +
      '* `set [field] [value]`: Set a field on yourself\n' +
      '* `help`: This message\n';

      it('should show when using the help argument', () => {
        return doCommand('info help').then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: helpText
          });
        });
      });

      it('should show when /info is called by itself', () => {
        return doCommand('info').then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: helpText
          });
        });
      });
    });

    describe('property list', () => {
      const listText =
      '#### Avaliable datasphere info fields:\n' +
      '* *Species*: Phenotypic representation\n' +
      '* *Gender*: Whatever you say it is\n\n' +
      'Use `/info set [field] [value]` to set yours!\n' +
      'All fields may be formatted using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)\n';

      it('should list available properties', () => {
        return doCommand('info list').then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: listText
          });
        });
      });
    });

    describe('setting properties', () => {
      const userName = reqTemplate.user_name;
      it('should initially show no properties', () => {
        return doCommand('info ' + userName).then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: 'No info found for dummy-user_name'
          });
        });
      });

      it('should successfully set a property', () => {
        return doCommand('info set species infomorph')
        .then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: '`species` has been set to `infomorph`'
          });
        })
        .then(() => { return doCommand('info ' + userName); })
        .then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: '#### Datasphere record for dummy-user_name:\n' +
                  '* *Species*: infomorph\n' +
                  '* *Gender*: (unset)\n'
          });
        });
      });

      it('should set a second property while maintaining the first', () => {
        return doCommand('info set gender neutral')
        .then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: '`gender` has been set to `neutral`'
          });
        })
        .then(() => { return doCommand('info ' + userName); })
        .then(response => {
          expect(response).to.deep.equal({
            response_type: 'ephemeral',
            text: '#### Datasphere record for dummy-user_name:\n' +
                  '* *Species*: infomorph\n' +
                  '* *Gender*: neutral\n'
          });
        });
      });

    });
  });

  const charData = JSON.stringify({
    desc: 'This is my new description',
    species: 'infomorph',
    gender: 'neutral'
  });

  describe('/archive', () => {

    it('should return a JSON dump of user props', () => {
      return doCommand('archive')
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Character data archive:\n```\n' + charData + '\n```\n'
        });
      });
    });
  });

  describe('/unarchive', () => {
    const newCharData = JSON.stringify({
      desc: 'This is an updated description',
      species: 'more differenter infomorph',
      gender: 'still neutral'
    });

    it('should refuse to apply an invalid character archive', () => {
      return doCommand('unarchive ' + newCharData.substr(2))
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'That doesn\'t look like a valid character archive!'
        });
      })
      .then(() => {return doCommand('archive');})
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Character data archive:\n```\n' + charData + '\n```\n'
        });
      });
    });

    it('should apply a valid character archive', () => {
      return doCommand('unarchive ' + newCharData)
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Character archive successfully applied.'
        });
      })
      .then(() => {return doCommand('archive');})
      .then(response => {
        expect(response).to.deep.equal({
          response_type: 'ephemeral',
          text: 'Character data archive:\n```\n' + newCharData + '\n```\n'
        });
      });
    });
  });

  after(() => {
    server.close();
  });
});
