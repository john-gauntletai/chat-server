const express = require('express');
const { Webhook } = require('svix');
const pusher = require('../config/pusher');
const supabase = require('../config/supabase');

module.exports = () => {
  const router = express.Router();

  router.post(
    '/clerk',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const svixHeaders = req.headers;
      const svixId = svixHeaders['svix-id'];
      const svixTimestamp = svixHeaders['svix-timestamp'];
      const svixSignature = svixHeaders['svix-signature'];
      const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
      const evt = await wh.verify(req.body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });

      const { id, ...attributes } = evt.data;

      try {
        switch (evt.type) {
          case 'session.created':
            const sessionUserId = evt.data.user_id;

            // Update user status to online
            const { error: onlineError } = await supabase
              .from('user_statuses')
              .update({ status: 'online' })
              .eq('user_id', sessionUserId);

            if (onlineError) {
              console.error(
                'Error updating user status to online:',
                onlineError
              );
            }

            // Notify clients about status change
            await pusher.trigger('presence', 'user:status_changed', {
              user_id: sessionUserId,
              status: 'online',
            });
            console.log('User status updated to online');
            break;

          case 'session.ended':
            console.log('Session ended:', evt.data);
            const endedSessionUserId = evt.data.user_id;

            // Update user status to offline
            const { error: offlineError } = await supabase
              .from('user_statuses')
              .update({ status: 'offline' })
              .eq('user_id', endedSessionUserId);

            if (offlineError) {
              console.error(
                'Error updating user status to offline:',
                offlineError
              );
            }

            // Notify clients about status change
            await pusher.trigger('presence', 'user:status_changed', {
              user_id: endedSessionUserId,
              status: 'offline',
            });
            break;

          case 'user.created':
            const {
              id,
              username,
              email_addresses,
              first_name,
              last_name,
              image_url,
            } = evt.data;

            // Add user status record
            const { error: statusError } = await supabase
              .from('user_statuses')
              .insert([
                {
                  user_id: id,
                  status: 'offline',
                },
              ]);

            if (statusError) {
              console.error('Error creating user status:', statusError);
            }

            // Add user to conversation #1 (general channel)
            const { error: joinError } = await supabase
              .from('conversation_members')
              .insert([
                {
                  conversation_id: 1,
                  user_id: id,
                },
              ]);

            if (joinError) {
              console.error('Error adding user to general channel:', joinError);
            }

            // Get the updated conversation to broadcast
            const { data: conversation, error: fetchError } = await supabase
              .from('conversations')
              .select(
                `
                *,
                conversation_members (user_id)
              `
              )
              .eq('id', 1)
              .single();

            if (!fetchError) {
              // Notify clients about the updated conversation
              await pusher.trigger(
                `conversation-${conversation.id}`,
                'conversation:updated',
                {
                  conversation,
                }
              );
            }

            // Notify about new user as before
            await pusher.trigger('global', 'user:created', {
              user: {
                id,
                email: email_addresses[0]?.email_address,
                username: username,
                imageUrl: image_url,
              },
            });
            break;

          case 'user.updated':
            console.log('User updated:', evt.data);
            break;

          case 'user.deleted':
            console.log('User deleted:', evt.data);
            break;

          default:
            console.log('Unhandled webhook event:', evt.type);
        }

        res.json({ received: true });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
      }
    }
  );

  return router;
};
