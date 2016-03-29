'use strict';

// Redis setup
var redis = require('redis');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var redisInterface = function() {
  this.client = redis.createClient();
};

redisInterface.prototype = {
  setWorld: function(world) {
    this.world = world;
  },

  getUserKey: function(theUsername) {
    var username = theUsername.toLowerCase();
    if (username[0] !== '@') {
      username = '@' + username;
    }
    return this.world + ':' + username;
  },

  getUser: function(username) {
    return this.client.getAsync(this.getUserKey(username)).then(function(response){
      if (response) {
        return JSON.parse(response);
      } else {
        return {};
      }
    });
  },

  setUser: function(username, properties) {
    var textData = JSON.stringify(properties);
    return this.client.setAsync(this.getUserKey(username), textData);
  },

  updateUser: function(username, key, value) {
    var _this = this;
    return this.getUser(username).then(function(userProps) {
      userProps[key] = value;
      return _this.setUser(username, userProps);
    });
  }
};

module.exports = new redisInterface();
