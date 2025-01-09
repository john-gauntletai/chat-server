const express = require('express');
const router = express.Router();
const { clerkClient } = require('@clerk/express');
const supabase = require('../config/supabase');

// Router factory function
module.exports = function () {
  // Get all users
  router.get('/', async (req, res) => {
    try {
      // Using Clerk's client to get all users
      const users = await clerkClient.users.getUserList();
      res.json({ users: users.data });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  router.get('/me/conversations', async (req, res) => {
    try {
      const userId = req.auth.userId;

      // First get all conversations where the user is a member
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members!inner (user_id)
        `
        )
        .eq('conversation_members.user_id', userId)
        .order('created_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      res.json({
        conversations,
      });
    } catch (error) {
      console.error('Error fetching user conversations and messages:', error);
      res
        .status(500)
        .json({ error: 'Failed to fetch conversations and messages' });
    }
  });

  return router;
};
