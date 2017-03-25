/*
 * Copyright 2017 Matt Kenney
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

const parse = require('csv-parse');
const redis = require('redis').createClient();

const BOX_COUNT = 5;

module.exports = {

  create: function (user, name, callback) {
    const decksKey = 'decks/' + user.uuid;
    redis.incr('deckCount', (err, id) => {
      redis.hset(decksKey, id, name, err => callback(err, id));
    });
  },

  define: function (id, term, definition, callback)
  {
    redis.hset('deck/' + id, term, definition, callback);
  },

  fill: function (id, csv, callback) {
    const deckKey = 'deck/' + id;
    const boxKey = deckKey + '/0';
    parse(csv, (err, rows) => {
      if (err) return callback(err);
      rows.forEach(row => {
        redis.hset(deckKey, row[0], row[1]);
        redis.sadd(boxKey, row[0]);
      });
      callback();
    });
  },

  get: function (user, id, callback) {
    const decksKey = 'decks/' + user.uuid;
    redis.hget(decksKey, id, function (err, name) {
      if (err) return callback(err);
      callback(null, name);
    });
  },

  list: function (user, callback) {
    const decksKey = 'decks/' + user.uuid;
    redis.hgetall(decksKey, function (err, obj) {
      if (err) return callback(err);
      const decks = (obj && Object.keys(obj).map(key => ({ key, name: obj[key] }))) || [];
      callback(null, decks);
    });
  },

  lookup: function (id, term, callback) {
    redis.hget('deck/' + id, term, callback);
  },

  move: function (id, term, box, move, callback) {
    let destination = box;
    switch (Number(move)) {
    case 0:
      destination = 0;
      break;
    case -1:
      destination = Math.max(0, box - 1);
      break;
    case 1:
      destination = Math.min(BOX_COUNT - 1, box + 1);
      break;
    }
    if (destination !== box) {
      redis.smove('deck/' + id + '/' + box, 'deck/' + id + '/' + destination, term, callback);
    } else if (callback) {
      setTimeout(() => callback(), 1);
    }
  },

  pick: function (id, callback)
  {
    const multi = redis.multi();
    for (let i = 0; i < BOX_COUNT; i++) {
      multi.scard('deck/' + id + '/' + i);
    }
    multi.exec((err, counts) => {
      if (err) return callback(err);
      const weights = counts.map((count, n) => count/Math.pow(2, n));
      const sum = weights.reduce((sum, weight) => sum + weight, 0);
      const cutoffs = weights.map(weight => weight / sum);
      cutoffs.reduce((sum, cutoff, n, cuoffs) => cutoffs[n] += sum, 0);
      const rand = Math.random();
      const last = BOX_COUNT - 1;
      for (let box = 0; box <= last; box++) {
        if (box >= last || rand < cutoffs[box]) {
          redis.srandmember('deck/' + id + '/' + box, (err, term) => callback(err, { box, term }));
          return;
        }
      }
    });
  }

};
