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

const url = require('url');

const express = require('express');
const multer  = require('multer');

const account = require('./account');
const decks = require('../lib/decks');

const router = express.Router({ strict: true });
const upload = multer();

router.use('/', account);

router.get('/', function (req, res, next) {
  const urlObj = url.parse(req.originalUrl);
  if (urlObj.pathname.slice(-1) !== '/') {
    urlObj.pathname += '/';
    res.redirect(url.format(urlObj));
    return;
  }
  next();
});

router.get('/', function (req, res, next) {
  decks.list(req.user, function (err, decks) {
    res.render('deck/list', { decks, user: req.user });
  });
});

router.post('/', upload.single('file'), function(req, res, next) {
  const name = String(req.body.name || '').trim();
  if (name && req.file) {
    decks.create(req.user, name, (err, num) => {
      const encoding = 'utf-8'; // req.file.encoding
      decks.fill(num, req.file.buffer.toString(encoding), err => {
        if (err) return next(err);
        const key = Number(num).toString(36);
        res.redirect(key + '/');
      });
    });
    return;
  }
  if (name || req.file) {
    req.flash('error', name ? 'File is required.' : 'Name is required.');
  }
  res.render('deck/new', { name });
});

router.get('/:key', function (req, res) {
  res.redirect(req.params.key + '/');
});

router.all('/:key/', function (req, res, next) {
  const id = parseInt(req.params.key, 36);
  decks.get(req.user, id, (err, name) => {
    if (err) return next(err);
    if (!name) {
      const err = new Error('Not Found');
      err.status = 404;
      return next(err);
    }
    res.locals.name = name;
    next();
  });
});

router.get('/:key/', function (req, res) {
  res.render('deck/index');
});

router.all('/:key/quiz', function (req, res, next) {
  const id = parseInt(req.params.key, 36);
  if (req.body.show || req.body.edit || req.body.save) {
    if (req.body.save) {
      decks.define(id, req.body.term, req.body.definition, err => {
          if (err) console.log(err);
      });
    }
    decks.lookup(id, req.body.term, (err, definition) => {
      if (err) return next(err);
      res.render(req.body.edit ? 'deck/edit' : 'deck/show', {
          box: req.body.box,
          term: req.body.term,
          definition
      });
    });
    return;
  }
  if (req.body.move) {
    decks.move(id, req.body.term, req.body.box, req.body.move, err => {
        if (err) console.log(err);
    });
  }
  decks.pick(id, (err, obj) => {
    res.render('deck/quiz', obj);
  });
});

module.exports = router;
