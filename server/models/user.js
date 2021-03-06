/**
 * user.js
 *
 * @description :: Generic model for all users on the site
 * @docs        :: https://github.com/CPSSD/feedlark/blob/master/doc/db/user.md
 */

const dbFuncs = require("../middleware/db");
const _ = require("lodash");

function encrypt(password, cb) {
  var bcrypt = require("bcrypt-nodejs");

  bcrypt.hash(password, null, null, (err, res) => {

    if (err) return cb(err);

    return cb(res);
  });
}

module.exports = {
  defaultPageLength: 20,

  // Gets user details
  findByEmail: (email, cb) => {
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {email: email}, cb));
  },

  findByUsername: (username, cb) => {
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {username: username}, cb));
  },

  findByToken: (token, cb) => {
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {verified: token}, cb));
  },

  // Returns a user if one exists
  exists: (username, email, cb) => {
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {"$or": [{username: username}, {email: email}]}, cb));
  },

  create: (username, email, password, token, cb) => {

    // Encrypt the password first
    encrypt(password, new_password => dbFuncs.transaction(db => dbFuncs.insert(db, "user", {
      username: username,
      email: email,
      verified: token,
      password: new_password,
      subscribed_feeds: []

    // Also create the blank entry in g2g
    }, _ => dbFuncs.insert(db, "g2g", {
        username: username,
        feeds: []
      }, _ => dbFuncs.insert(db, "bookmark", {
          username: username,
          bookmarks: []
        }, cb)))));
  },

  updatePassword: (user, password, cb) => {
    var username = user.username;
    // Encrypt the password first
    encrypt(password, new_password => dbFuncs.transaction(db => dbFuncs.update(db, "user", {username: username}, {
      password: new_password
    }, cb)));
  },

  updateEmail: (username, newEmail, token, cb) => {
    dbFuncs.transaction(db => dbFuncs.update(db, "user", {username: username}, {
      email: newEmail,
      verified: token
    }, cb));
  },

  updateSummaryInterval: (username, newSummaryInterval, cb) => {
    dbFuncs.transaction(db => dbFuncs.update(db, "user", {username: username}, {
      summaryInterval: newSummaryInterval,
      nextSummary: new Date(Date.now() + newSummaryInterval * 3600000)
    }, cb));
  },

  verify: (token, cb) => {
    dbFuncs.transaction(db => dbFuncs.update(
      db,
      "user",
      {verified: token},
      {verified: true},
      cb
    ));
  },

  addFeed: (db, username, url, cb) => {

    dbFuncs.findOne(db, "user", {username: username}, user => {

      // Check if the user is already subscribed to this feed
      if (user.subscribed_feeds.indexOf(url) > -1) return cb();

      // Append and update
      user.subscribed_feeds.push(url);
      dbFuncs.update(
        db,
        "user",
        {username: username},
        {subscribed_feeds: user.subscribed_feeds},
        _ => cb(user.subscribed_feeds)
      );
    });
  },

  removeFeed: (username, url, cb) => {

    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {username: username}, user => {

      // Check if the user is already subscribed to this feed
      var index = user.subscribed_feeds.indexOf(url);
      if (index == -1) return cb();

      // Append and update
      user.subscribed_feeds.splice(index, 1);
      dbFuncs.update(
        db,
        "user",
        {username: username},
        {subscribed_feeds: user.subscribed_feeds},
        _ => cb(user.subscribed_feeds)
      );
    }));
  },

  addToken: (username, token, cb) => {
    if (!token || !username) {
      return cb();
    }
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {username: username}, user => {

      // TODO Add and render error message
      if (!user.tokens) {
        user.tokens = {};
      }
      user.tokens[token] = true;


      // TODO: check for max tokens
      dbFuncs.update(
        db,
        "user",
        {username: username},
        {tokens: user.tokens},
        cb
      );
    }));
  },

  removeToken: (username, token, cb) => {
    dbFuncs.transaction(db => dbFuncs.findOne(db, "user", {username: username}, user => {
      if (typeof user.tokens != "undefined") {
        delete user.tokens[token];
      }
      dbFuncs.update(
        db,
        "user",
        {username: username},
        {tokens: user.tokens},
        cb
      );
    }));
  },

  setPageLength: (username, page_length, cb) => {
    /// NOTE trusts the programmer not to be bad.
    //  knowing how stupid I am, probably should add checks here
    //  it is tested elsewhere though for correctness :)
    dbFuncs.transaction(db => {
      dbFuncs.update(
        db,
        "user",
        {username: username},
        {page_length: page_length},
        cb
      );
    });
  },

  // Returns a list of users that need a summary sent to them
  getSummaryUsers: (db, cb) => {
    dbFuncs.find(db, "user", {summaryInterval: {"$gt": 0}, nextSummary: {"$lte": new Date()}}, cb);
  }
};
