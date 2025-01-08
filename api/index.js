const express = require('express');
const router = express.Router();
const { clerkClient } = require('@clerk/express');
const supabase = require('../config/supabase');
const pusher = require('../config/pusher');

// Router factory function
module.exports = function () {
  // Get all users
  router.get('/users', async (req, res) => {
    try {
      // Using Clerk's client to get all users
      const users = await clerkClient.users.getUserList();
      res.json({ users: users.data });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get all channels
  router.get('/channels', async (req, res) => {
    try {
      const { data: channels, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.json({ channels });
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  // Get messages (with optional channel filter)
  router.get('/messages', async (req, res) => {
    try {
      const { channelId } = req.query;
      let query = supabase
        .from('messages')
        .select(
          `
          *,
          channels (id, name)
        `
        )
        .order('created_at', { ascending: false });

      // If channelId is provided, filter messages by channel
      if (channelId) {
        query = query.eq('channel_id', channelId);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      res.json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Add a new channel
  router.post('/channels', async (req, res) => {
    try {
      const { name, description } = req.body;
      const { data: channel, error } = await supabase
        .from('channels')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;

      // Trigger Pusher event with the new channel
      await pusher.trigger('global', 'channel:created', { channel });

      res.status(201).json({ channel });
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  });

  // Add a new message
  router.post('/messages', async (req, res) => {
    try {
      const { content, channelId } = req.body;
      const userId = req.auth.userId;

      // Get user details from Clerk
      const user = await clerkClient.users.getUser(userId);

      const { data: message, error } = await supabase
        .from('messages')
        .insert([
          {
            content,
            channel_id: channelId,
            created_by: userId,
          },
        ])
        .select(
          `
          *,
          channels (id, name)
        `
        )
        .single();

      if (error) throw error;

      // Trigger Pusher event with the new message and user details
      await pusher.trigger(`channel-${channelId}`, 'message:created', {
        message,
      });

      res.status(201).json({ message });
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });
  return router;
};
