const express = require('express');
const router = express.Router();
const { clerkClient } = require('@clerk/express');
const supabase = require('../config/supabase');
const pusher = require('../config/pusher');

// Router factory function
module.exports = function () {
  // Get messages (with optional conversation filter)
  router.get('/', async (req, res) => {
    try {
      const { conversationId } = req.query;
      let query = supabase
        .from('messages')
        .select(
          `
          *,
          conversations (id, name)
        `
        )
        .order('created_at', { ascending: false });

      // If conversationId is provided, filter messages by conversation
      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      res.json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Add a new message
  router.post('/', async (req, res) => {
    try {
      const { content, conversationId, parentMessageId } = req.body;
      const userId = req.auth.userId;

      // Get user details from Clerk
      const user = await clerkClient.users.getUser(userId);

      // Start a transaction for creating message and reply relationship
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            content,
            conversation_id: conversationId,
            created_by: userId,
            parent_message_id: parentMessageId || null,
          },
        ])
        .select(
          `
          *,
          conversations (id, name)
        `
        )
        .single();

      if (messageError) throw messageError;

      // Trigger Pusher event with the new message
      await pusher.trigger(
        `conversation-${conversationId}`,
        'message:created',
        {
          message,
        }
      );

      res.status(201).json({ message });
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  // Add/remove a reaction to a message
  router.post('/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.auth.userId;

      // First, get the current message
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      // Initialize or update reactions array
      let reactions = message.reactions || [];

      // Find existing reaction with the same emoji
      const existingReactionIndex = reactions.findIndex(
        (r) => r.emoji === emoji
      );

      if (existingReactionIndex >= 0) {
        // If user has already reacted with this emoji, remove their reaction
        if (reactions[existingReactionIndex].users.includes(userId)) {
          reactions[existingReactionIndex].users = reactions[
            existingReactionIndex
          ].users.filter((id) => id !== userId);

          // If no users left for this reaction, remove the reaction entirely
          if (reactions[existingReactionIndex].users.length === 0) {
            reactions = reactions.filter(
              (_, index) => index !== existingReactionIndex
            );
          }
        } else {
          // If user hasn't reacted with this emoji yet, add them
          reactions[existingReactionIndex].users.push(userId);
        }
      } else {
        // Add new reaction
        reactions.push({
          emoji,
          users: [userId],
        });
      }

      // Update the message with new reactions
      const { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update({ reactions })
        .eq('id', messageId)
        .select(
          `
          *,
          conversations (id, name)
        `
        )
        .single();

      if (updateError) throw updateError;

      // Trigger Pusher event with the updated message
      await pusher.trigger(
        `conversation-${updatedMessage.conversation_id}`,
        'message:updated',
        {
          message: updatedMessage,
        }
      );

      res.json({ message: updatedMessage });
    } catch (error) {
      console.error('Error updating reaction:', error);
      res.status(500).json({ error: 'Failed to update reaction' });
    }
  });

  return router;
};
