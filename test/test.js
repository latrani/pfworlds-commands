"use strict";

const chai = require('chai');
const _ = require('underscore');
const rp = require('request-promise');
const qs = require('qs');
const http = require('http');
const expect = require('chai').expect;

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
  }).then((response) => {
    const jsonResponse = JSON.parse(response);
    return jsonResponse;
  });
};

describe('Server', () => {
  var server;
  before(() => {
    server = http.createServer(requestHandler);
    server.listen(0, '127.0.0.1', function() {
      const address = server.address();
      baseURL = `http://${address.address}:${address.port}/`;
      console.log(baseURL);
    });
  });

  it('should have an OOC command', (done) => {
    doCommand('ooc Test test test').then((response) => {
      expect(response).to.deep.equal({
        response_type: 'in_channel',
        text: '*[OOC]* Test test test'
      });
      done();
    });
  });

  after(() => {
    server.close();
  });
});
