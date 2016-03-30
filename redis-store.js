'use strict';

// Redis setup
var redis = require('redis');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var createRedisMethods = function(client, keyFunc) {
  var methods = {}
  methods.get = function(objKey) {
    return client.getAsync(keyFunc(objKey)).then(function(response){
      if (response) {
        return JSON.parse(response);
      } else {
        return {};
      }
    });
  },
  methods.set = function(objKey, properties) {
    var textData = JSON.stringify(properties);
    return client.setAsync(keyFunc(objKey), textData);
  }
  methods.update = function(objKey, key, value) {
    return methods.get(objKey).then(function(objProps) {
      objProps[key] = value;
      return methods.set(objKey, objProps);
    });
  }

  return methods;
}

var redisInterface = function() {
  this.client = redis.createClient();

  var _this = this;

  // These are okay because this is a singleton
  this.user = createRedisMethods(this.client, function(theUsername) {
    var username = theUsername.toLowerCase();
    if (username[0] !== '@') {
      username = '@' + username;
    }
    return _this.world + ':' + username;
  });

  this.channel = createRedisMethods(this.client, function(channelId) {
    return _this.world + ':' + channelId;
  });
};

redisInterface.prototype = {
  setWorld: function(world) {
    this.world = world;
  }
};

// Return a singleton
module.exports = new redisInterface();
