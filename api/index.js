const express = require('express');
const router = express.Router();
const usersRouter = require('./users');
const messagesRouter = require('./messages');
const conversationsRouter = require('./conversations');

// Router factory function
module.exports = function () {
  router.use('/users', usersRouter());
  router.use('/messages', messagesRouter());
  router.use('/conversations', conversationsRouter());

  return router;
};
