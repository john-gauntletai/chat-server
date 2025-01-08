const express = require('express');
const { Webhook } = require('svix');
const pusher = require('../config/pusher');

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
