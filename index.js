require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { clerkClient, clerkMiddleware, requireAuth } = require('@clerk/express');
const apiRouter = require('./api');
const webhookRouter = require('./webhook');
const pusher = require('./config/pusher');
const app = express();
const PORT = process.env.PORT || 3000;

app.use('/webhook', webhookRouter());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  // Log the incoming request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  next();
});

app.get('/session', requireAuth(), async (req, res) => {
  const { userId } = req.auth;
  const user = await clerkClient.users.getUser(userId);
  return res.json({ user });
});

// Add presence conversation authentication
app.post('/pusher/auth', requireAuth(), async (req, res) => {
  const socketId = req.body.socket_id;
  const conversation = req.body.conversation_name;
  const userId = req.auth.userId;

  try {
    // Get user details from Clerk
    const user = await clerkClient.users.getUser(userId);

    // Generate auth response for Pusher
    const authResponse = pusher.authorizeChannel(socketId, conversation, {
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

app.use('/api', requireAuth(), apiRouter());

app.get('/signin', (req, res) => {
  console.error('unauthorized');
  res.redirect(process.env.CLIENT_URL + '/signin');
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
