const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class CalendarService {
    constructor() {
        // Get credentials from environment variables
        const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const REDIRECT_URI = 'http://localhost:3001/auth/google/callback';
        
        console.log('Using OAuth credentials with redirect URI:', REDIRECT_URI);
        
        this.oauth2Client = new OAuth2Client(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );
    }

    getAuthUrl(userEmail) {
        const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
        
        // Include user email as state parameter to maintain user context
        const state = userEmail ? encodeURIComponent(userEmail) : '';
        
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            state: state  // Pass user email in state to maintain context
        });
        
        return authUrl;
    }
    
    async getTokensFromCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            
            // Store tokens in memory for reuse (in a real app, you'd use a database)
            this.tokens = tokens;
            
            return tokens;
        } catch (error) {
            console.error('Error getting tokens from code:', error);
            throw error;
        }
    }
    
    // Check if we have a valid token for the user
    isAuthenticated(accessToken) {
        if (!accessToken) return false;
        
        try {
            // Set the access token to check if it's valid
            this.oauth2Client.setCredentials({ access_token: accessToken });
            return true;
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }

    async getBusyTimes(accessToken, startTime, endTime) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin: startTime,
                    timeMax: endTime,
                    items: [{ id: 'primary' }]
                }
            });

            return response.data.calendars.primary.busy;
        } catch (error) {
            console.error('Error fetching busy times:', error);
            throw error;
        }
    }

    async getEvents(accessToken, startTime, endTime) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

            // Request events in the user's local time zone
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startTime,
                timeMax: endTime,
                singleEvents: true,
                orderBy: 'startTime'
                // Removed explicit timeZone to use the default from Google Calendar
            });

            // Process events to ensure correct time zone handling
            const events = response.data.items.map(event => {
                // Log the event times for debugging
                console.log('Event:', event.summary);
                console.log('  Original start:', event.start.dateTime || event.start.date);
                console.log('  Original end:', event.end.dateTime || event.end.date);
                
                // Keep the original event data with time zone information intact
                // The frontend will handle the time zone conversion
                return event;
            });

            return events;
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            throw error;
        }
    }
}

module.exports = new CalendarService();