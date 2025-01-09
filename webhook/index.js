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
          case 'user.created':
            const {
              id,
              username,
              email_addresses,
              first_name,
              last_name,
              image_url,
            } = evt.data;

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
