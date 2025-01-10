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

      // First get all conversations where user is a member
      const { data: userConversations, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      if (!userConversations.length) {
        return res.json({ conversations: [] });
      }

      // Then get full conversation details with all members
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members (user_id)
        `
        )
        .in(
          'id',
          userConversations.map((uc) => uc.conversation_id)
        )
        .order('created_at', { ascending: true });

      if (convError) throw convError;

      res.json({ conversations });
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  router.get('/statuses', async (req, res) => {
    try {
      const { data: statuses, error } = await supabase
        .from('user_statuses')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.json({ statuses });
    } catch (error) {
      console.error('Error fetching user statuses:', error);
      res.status(500).json({ error: 'Failed to fetch user statuses' });
    }
  });

  return router;
};
