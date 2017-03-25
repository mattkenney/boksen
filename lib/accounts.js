/*
 * Copyright 2012, 2017 Matt Kenney
 *
 * This file is part of Boksen.
 *
 * Boksen is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * Boksen is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Boksen.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const crypto = require('crypto');
const redis = require("redis").createClient();
const uuid = require("uuid");
const XRegExp = require('xregexp');

const encode = require('./encode');

function username2key(username) {
  return ('user/' + encode.encode_segment(String(username).toLowerCase()));
}

function encryptPassword(secret, options, callback) {
  let rounds = options && options.rounds || 6400;
  let saltSize = options && options.saltSize || 16;
  let salt = options && options.salt || crypto.randomBytes(saltSize).toString('binary');
  let size = options && options.size || 20;

  crypto.pbkdf2(secret, salt, rounds, size, 'sha1', function (err, key) {
    let hash = '$pbkdf2$' + rounds + '$' + encode.ab64encode(salt) + '$' + encode.ab64encode(key);
    callback(err, hash);
  });
}

function makeHandle(name) {
  name = XRegExp.replace(name, XRegExp('^\\P{L}+'), '');
  name = XRegExp.replace(name, XRegExp('\\P{L}+$'), '');
  name = XRegExp.replace(name, XRegExp('[^\\p{L}\\p{N}]+', 'g'), '.');
  return encodeURIComponent(name.toLowerCase());
}

let m_dummy;
encryptPassword('password', null, function (err, value) {
  m_dummy = value;
});

const accounts = module.exports = {
  serializeUser: function (user, callback) {
    callback(null, user && user.key);
  },

  deserializeUser: function (key, callback) {
    redis.hgetall(key, function (err, user) {
      if (user) {
        user.key = key;
      }
      callback(err, user);
    });
  },

  createUser: function (username, password, name, callback) {
    encryptPassword(password, null, function (err, value) {
      if (err) return callback(err);
      let handle = makeHandle(name);
      redis.incr('handle/' + handle, function (err, count) {
        if (err) return callback(err);
        if ((0|count) > 1) {
          handle += '.' + count;
        }
        let user = {
            email: username,
            handle: handle,
            name: name,
            password: value,
            uuid: uuid.v4()
          },
          key = username2key(username);
        redis.hmset(key, user, function (err) {
          if (err) return callback(err);
          user.key = key;
          callback(null, user);
        });
      });
    });
  },

  facebookUser: function (accessToken, refreshToken, profile, callback) {
    let key = 'user/facebook/' + encode.encode_segment(profile.id);
    redis.hgetall(key, function (err, user) {
      if (err) return callback (err);
      if (user && user.handle) {
        user.key = key;
        callback(err, user);
        return;
      }
      let handle = makeHandle(profile.displayName);
      redis.incr('handle/' + handle, function (err, count)
      {
        if (err) return callback(err);
        if ((0|count) > 1) {
          handle += '.' + count;
        }
        let user = {
            authenticator:'Facebook',
            email: profile.emails[0].value,
            handle: handle,
            name: profile.displayName,
            uuid: uuid.v4()
          };
        redis.hmset(key, user, function (err) {
          if (err) return callback(err);
          user.key = key;
          callback(null, user);
        });
      });

    });
  },

  getUserProperty: function (username, propname, callback) {
    redis.hget(username2key(username), propname, callback)
  },

  setPassword: function (username, password, callback) {
    encryptPassword(password, null, function (err, hash) {
      if (err) return callback(err);
      redis.hset(username2key(username), "password", hash, function (err) {
        if (err) { callback(err); return; }
        callback();
      });
    });
  },

  setUserProperty: function (key, propname, propvalue, callback) {
    redis.hset(key, propname, propvalue, function (err) {
      if (err) return callback(err);
      callback();
    });
  },

  validateParameters: function (username, password, name) {
    let result =[];
    if (makeHandle(name).length < 1) {
      result.push('Full name is required');
    }
    if (!(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i).test(username)) {
      result.push('Missing or incomplete e-mail address.');
    }
    if (password.length < 6) {
      result.push('Your password must be at least six characters long.');
    }
    return (result.length ? result : false);
  },

  verify: function (username, password, callback) {
    let key = username2key(username);
    redis.hgetall(key, function (err, value) {
      if (err) return callback(err);
      let secret = value && value.password || m_dummy;
      accounts.verifyPassword(password, secret, function (err, result) {
        if (err) return callback(err);
        if (value && result) {
          value.key = key;
          callback(null, value);
        } else {
          callback(null, false, { message: 'Wrong E-mail/password combination.' });
        }
      });
    });
  },

  verifyPassword: function (secret, hash, callback) {
    let parts = (/^\$pbkdf2\$([^\$]+)\$([^\$]+)\$([^\$]+)$/).exec(hash);
    encryptPassword(
      secret, {
        rounds: parts && parts[1] && (0|parts[1]),
        salt: parts && parts[2] && encode.ab64decode(parts[2])
      },
      function (err, key) {
        callback(err, !!(parts && hash === key));
      }
    );
  }
};
