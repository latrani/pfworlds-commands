'use strict';

// Redis setup
var redis = require('redis');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

class redisAccessors {
  constructor(client, keyFunc) {
    this.client = client;
    this.keyFunc = keyFunc;
  }
  get(objKey) {
    return this.client.getAsync(this.keyFunc(objKey)).then(function(response){
      if (response) {
        return JSON.parse(response);
      } else {
        return {};
      }
    });
  }
  set(objKey, properties) {
    var textData = JSON.stringify(properties);
    return this.client.setAsync(this.keyFunc(objKey), textData);
  }
  update(objKey, key, value) {
    return this.get(objKey).then(objProps => {
      objProps[key] = value;
      return this.set(objKey, objProps);
    });
  }
}

class redisInterface {
  constructor() {
    this.client = redis.createClient();

    this.user = new redisAccessors(this.client, theUsername => {
      var username = theUsername.toLowerCase();
      if (username[0] !== '@') {
        username = '@' + username;
      }
      return this.world + ':' + username;
    });

    this.channel = new redisAccessors(this.client, channelId => {
      return this.world + ':' + channelId;
    });
  }

  setWorld(world) {
    this.world = world;
  }
}

// Return a singleton
module.exports = new redisInterface();
