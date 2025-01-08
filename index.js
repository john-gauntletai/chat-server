require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { clerkClient, clerkMiddleware, requireAuth } = require('@clerk/express');
const apiRouter = require('./api');
// const Webhook = require('svix').Webhook;
const pusher = require('./config/pusher');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:3000'];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pusher-Library'],
  })
);

app.get('/session', requireAuth(), async (req, res) => {
  const { userId } = req.auth;
  const user = await clerkClient.users.getUser(userId);
  return res.json({ user });
});

// Add presence channel authentication
app.post('/pusher/auth', requireAuth(), async (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  const userId = req.auth.userId;

  try {
    // Get user details from Clerk
    const user = await clerkClient.users.getUser(userId);

    // Generate auth response for Pusher
    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: userId,
      user_info: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
      },
    });

    res.send(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Pusher' });
  }
});

// // Add this route before your other routes
// app.post(
//   '/webhook/clerk',
//   bodyParser.raw({ type: 'application/json' }),
//   async (req, res) => {
//     const svixHeaders = req.headers;
//     const svixId = svixHeaders['svix-id'];
//     const svixTimestamp = svixHeaders['svix-timestamp'];
//     const svixSignature = svixHeaders['svix-signature'];
//     const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
//     const evt = await wh.verify(req.body.toString(), {
//       'svix-id': svixId,
//       'svix-timestamp': svixTimestamp,
//       'svix-signature': svixSignature,
//     });

//     const { id, ...attributes } = evt.data;

//     try {
//       switch (evt.type) {
//         case 'user.created':
//           const {
//             id,
//             username,
//             email_addresses,
//             first_name,
//             last_name,
//             image_url,
//           } = evt.data;
//           console.log('New user created:', {
//             id,
//             email: email_addresses[0]?.email_address,
//             firstName: first_name,
//             username: username,
//             lastName: last_name,
//             imageUrl: image_url,
//           });

//           // Here you can add code to:
//           // 1. Add the user to your database
//           // 2. Send a welcome email
//           // 3. Create default channels/workspace for the user
//           // 4. etc.
//           // Trigger Pusher event for new user creation
//           console.log('Triggering Pusher event for new user creation');
//           await pusher.trigger('global', 'user:created', {
//             user: {
//               id,
//               email: email_addresses[0]?.email_address,
//               username: username,
//               imageUrl: image_url,
//             },
//           });

//           break;

//         // You can handle other webhook events here
//         case 'user.updated':
//           console.log('User updated:', evt.data);
//           break;

//         case 'user.deleted':
//           console.log('User deleted:', evt.data);
//           break;

//         default:
//           console.log('Unhandled webhook event:', evt.type);
//       }

//       res.json({ received: true });
//     } catch (error) {
//       console.error('Webhook error:', error);
//       res.status(500).json({ error: 'Webhook handler failed' });
//     }
//   }
// );

app.use('/api', requireAuth(), apiRouter());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
