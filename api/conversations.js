const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const pusher = require('../config/pusher');

// Router factory function
module.exports = function () {
  router.get('/', async (req, res) => {
    try {
      const { data: rawConversations, error } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members:conversation_members(user_id)
        `
        )
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform the conversation_members into arrays of user_ids
      const conversations = rawConversations.map((conv) => ({
        ...conv,
        conversation_members: conv.conversation_members.map((member) => ({
          user_id: member.user_id,
        })),
      }));

      res.json({ conversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  router.post('/:conversationId/join', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.auth.userId;

      // First check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('conversation_members')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      if (existingMember) {
        return res
          .status(400)
          .json({ error: 'Already a member of this conversation' });
      }

      // Add user as a member
      const { error: joinError } = await supabase
        .from('conversation_members')
        .insert([
          {
            conversation_id: conversationId,
            user_id: userId,
          },
        ]);

      if (joinError) throw joinError;

      // Get the updated conversation with members
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members (user_id)
        `
        )
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      // Notify other clients about the new member
      await pusher.trigger(
        `conversation-${conversationId}`,
        'conversation:updated',
        {
          conversation,
        }
      );

      res.json({ conversation });
    } catch (error) {
      console.error('Error joining conversation:', error);
      res.status(500).json({ error: 'Failed to join conversation' });
    }
  });

  // Add a new conversation
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        is_channel = true,
        is_public = true,
        members = [],
      } = req.body;
      const userId = req.auth.userId;

      // For DMs (non-channels), check if conversation already exists with exact members
      if (!is_channel) {
        const allMembers = [...members, userId].sort();

        // Get all non-channel conversations
        const { data: existingConvs, error: fetchError } = await supabase
          .from('conversations')
          .select(
            `
            *,
            conversation_members (user_id)
          `
          )
          .eq('is_channel', false);

        if (fetchError) throw fetchError;

        // Find conversation with exact same members
        const existingConversation = existingConvs?.find((conv) => {
          const convMembers = conv.conversation_members
            .map((m) => m.user_id)
            .sort();
          return (
            convMembers.length === allMembers.length &&
            convMembers.every((id, index) => id === allMembers[index])
          );
        });

        if (existingConversation) {
          return res.json({ conversation: existingConversation });
        }
      }

      // If no existing conversation found, create new one
      const { data: conversation, error: createError } = await supabase
        .from('conversations')
        .insert([
          {
            name,
            is_channel,
            is_public,
            created_by: userId,
          },
        ])
        .select(
          `
          *,
          conversation_members (user_id)
        `
        )
        .single();

      if (createError) throw createError;

      // Prepare member entries including creator and additional members
      const memberEntries = [
        { conversation_id: conversation.id, user_id: userId },
        ...members.map((memberId) => ({
          conversation_id: conversation.id,
          user_id: memberId,
        })),
      ];

      // Add all members
      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert(memberEntries);

      if (memberError) throw memberError;

      // Get the updated conversation with all members
      const { data: updatedConversation, error: fetchError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members (user_id)
        `
        )
        .eq('id', conversation.id)
        .single();

      if (fetchError) throw fetchError;

      // Notify all members about the new conversation
      const allMemberIds = [userId, ...members];
      await Promise.all(
        allMemberIds.map((memberId) =>
          pusher.trigger(`user-${memberId}`, 'conversation:created', {
            conversation: updatedConversation,
          })
        )
      );

      res.status(201).json({ conversation: updatedConversation });
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  router.delete('/:conversationId/leave', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.auth.userId;

      // Delete the conversation member
      const { error: deleteError } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Get the updated conversation
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_members (user_id)
        `
        )
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      // Notify other clients about the member leaving
      await pusher.trigger(
        `conversation-${conversationId}`,
        'conversation:updated',
        {
          conversation,
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error leaving conversation:', error);
      res.status(500).json({ error: 'Failed to leave conversation' });
    }
  });

  return router;
};
