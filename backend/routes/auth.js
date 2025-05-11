const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// Load environment variables
require('dotenv').config();

// Initialize Google Sheets
async function getAuthClient() {
    const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    await auth.authorize();
    return auth;
}

// Initialize Google OAuth client
function getOAuthClient() {
    return new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3001/auth/google/callback'
    );
}

async function getSheetsInstance() {
    const auth = await getAuthClient();
    return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Google OAuth login endpoint
router.get('/google', (req, res) => {
    const oauth2Client = getOAuthClient();
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.redirect(authUrl);
});

// Google OAuth callback endpoint
router.get('/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Authorization code is required');
    }

    try {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user profile information
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data } = await oauth2.userinfo.get();

        // Check if user exists in Google Sheets
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A:D',
        });

        const users = response.data.values || [];
        let user = users.find(user => user[1] === data.email);

        if (!user) {
            // Add new user to Google Sheets
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Users!A:D',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [[data.name, data.email, '', new Date().toISOString()]]
                }
            });

            user = [data.name, data.email, ''];
        }

        // Create JWT token
        const token = jwt.sign({ email: data.email }, JWT_SECRET, { expiresIn: '24h' });

        // Store user data and tokens
        const userData = {
            name: user[0],
            email: user[1],
            team: user[2] || ''
        };

        // Set tokens in session or cookies
        res.redirect(`/login.html?token=${token}&google_auth=success&calendar_token=${tokens.access_token}`);
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.redirect('/login.html?google_auth=error');
    }
});

// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, team } = req.body;
        
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }
        
        const sheets = await getSheetsInstance();
        
        // Check if user exists
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A:B',
        });
        
        const users = response.data.values || [];
        if (users.find(user => user[1] === email)) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Add user to Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A:D',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[name, email, team, new Date().toISOString()]]
            }
        });
        
        // Create JWT token
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
        
        res.status(201).json({
            message: 'Registration successful',
            user: { name, email, team },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error during registration' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);
        
        const sheets = await getSheetsInstance();
        
        // Get user from Google Sheets
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A:D',
        });
        
        const users = response.data.values || [];
        console.log('All users:', users);
        
        const user = users.find(user => user[1] === email);
        console.log('Found user:', user);
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
        
        const userData = {
            name: user[0],
            email: user[1],
            team: user[2]
        };
        console.log('Sending user data:', userData);
        
        res.json({
            message: 'Login successful',
            user: userData,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error during login' });
    }
});

// Google Calendar Auth endpoints
router.get('/google/calendar', (req, res) => {
    // Check if token is provided and valid
    const token = req.query.token;
    const userEmail = req.query.email; // Get user email from query params
    const calendarService = require('../services/calendarService');
    
    if (token && calendarService.isAuthenticated(token)) {
        // Token is valid, no need for auth flow
        console.log('Using existing valid token');
        return res.json({ valid: true, token });
    }
    
    // No valid token, generate auth URL with user email
    const authUrl = calendarService.getAuthUrl(userEmail);
    console.log('Generated Auth URL for user:', userEmail);
    res.json({ authUrl });
});

// Endpoint to validate an existing token
router.get('/google/validate', (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.json({ valid: false });
    }
    
    const calendarService = require('../services/calendarService');
    const isValid = calendarService.isAuthenticated(token);
    
    res.json({ valid: isValid, token: isValid ? token : null });
});

router.get('/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).send('Authorization code is required');
        }
        
        // Decode the user email from state parameter if present
        const userEmail = state ? decodeURIComponent(state) : '';
        console.log('Google callback received for user:', userEmail);
        
        const calendarService = require('../services/calendarService');
        const tokens = await calendarService.getTokensFromCode(code);
        
        // Store the token with the user email for future reference
        if (userEmail) {
            // In a real app, you would store this in a database
            console.log(`Storing token for user ${userEmail}`);
            // For now, we'll just pass it back to the client
        }
        
        // Redirect to the schedule page with success parameter and user context
        res.redirect(`/schedule.html?calendar_auth=success&token=${tokens.access_token}&email=${encodeURIComponent(userEmail)}`);
    } catch (error) {
        console.error('Error in Google callback:', error);
        res.redirect('/schedule.html?calendar_auth=error');
    }
});

// Get calendar events
router.get('/calendar/events', async (req, res) => {
    try {
        const { token, start, end } = req.query;
        if (!token || !start || !end) {
            return res.status(400).json({ message: 'Token, start, and end dates are required' });
        }
        
        const calendarService = require('../services/calendarService');
        const events = await calendarService.getEvents(token, start, end);
        
        res.json({ events });
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ message: 'Error fetching calendar events' });
    }
});

// Get user info from token
router.get('/user', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization token is required' });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const email = decoded.email;
        
        // Get user data from Google Sheets
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A:D',
        });
        
        const users = response.data.values || [];
        const user = users.find(user => user[1] === email);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userData = {
            name: user[0],
            email: user[1],
            team: user[2] || ''
        };
        
        res.json({ user: userData });
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ message: 'Error getting user info' });
    }
});

module.exports = router;
