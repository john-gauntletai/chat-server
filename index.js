require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { clerkClient, clerkMiddleware, requireAuth } = require('@clerk/express');
const apiRouter = require('./api');

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
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/session', requireAuth(), async (req, res) => {
  const { userId } = req.auth;
  const user = await clerkClient.users.getUser(userId);
  return res.json({ user });
});

app.use('/api', requireAuth(), apiRouter());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
