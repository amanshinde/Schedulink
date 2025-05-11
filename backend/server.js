const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle frontend routes
app.get(['/', '/index.html', '/login.html', '/register.html', '/schedule.html', '/create-meeting.html'], (req, res) => {
    const requestedPage = req.path === '/' ? 'index.html' : req.path;
    res.sendFile(path.join(__dirname, '../frontend', requestedPage));
});

// Import routes
const userRoutes = require('./routes/users');
const scheduleRoutes = require('./routes/schedules');
const meetingRoutes = require('./routes/meetings');
const notificationRoutes = require('./routes/notifications');
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);

// Direct route for Google OAuth callback
app.get('/auth/google/callback', (req, res) => {
  // Forward to the auth route handler
  req.url = '/api/auth/google/callback' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  app._router.handle(req, res);
});

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Default route - serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;