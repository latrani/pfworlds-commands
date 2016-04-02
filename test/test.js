"use strict";

const chai = require('chai');
const _ = require('underscore');
const rp = require('request-promise');
const qs = require('qs');

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

var doCommand = function(theCommand) {
  const tokens = theCommand.split(' ');
  const command = _.first(tokens);
  const argument = _.rest(tokens).join(' ');

  const requestBody = _.extend({}, reqTemplate, {
    command: command,
    text: argument
  });

  return rp.post({
    url: 'http://localhost:8080/' + command,
    form: requestBody
  }).then((response) => {
    const jsonResponse = JSON.parse(response);
    return jsonResponse;
  });
};

describe('Server', () => {
  it('should have an OOC command', (done) => {
    doCommand('ooc Test test test').then((response) => {
      expect(response).to.deep.equal({
        response_type: 'in_channel',
        text: '*[OOC]* Test test test'
      });
      done();
    });
  });
});
