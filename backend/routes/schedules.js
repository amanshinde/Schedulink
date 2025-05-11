const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheetsService');
const calendarService = require('../services/calendarService');

// Get a user's schedule
router.get('/:userEmail', async (req, res) => {
  try {
    const userEmail = req.params.userEmail;
    const schedule = await sheetsService.getUserScheduleByEmail(userEmail);
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found for this user' });
    }
    
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ message: 'Error fetching schedule', error: error.message });
  }
});

// Update a user's schedule
router.post('/:userEmail', async (req, res) => {
  try {
    const userEmail = req.params.userEmail;
    const { schedule } = req.body;
    
    if (!schedule) {
      return res.status(400).json({ message: 'Schedule data is required' });
    }
    
    console.log('Updating schedule for user:', userEmail);
    console.log('Schedule data:', schedule);
    
    const updatedSchedule = await sheetsService.updateUserScheduleByEmail(userEmail, schedule);
    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Error updating schedule', error: error.message });
  }
});

// Get schedules for multiple users
router.post('/batch', async (req, res) => {
  try {
    const { userEmails } = req.body;
    
    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({ message: 'User emails array is required' });
    }
    
    const schedules = await sheetsService.getBatchSchedules(userEmails);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching batch schedules:', error);
    res.status(500).json({ message: 'Error fetching batch schedules', error: error.message });
  }
});

// Get Google Calendar events for a user
router.get('/:userEmail/calendar', async (req, res) => {
    try {
        const { accessToken } = req.headers;
        const { startTime, endTime } = req.query;

        if (!accessToken) {
            return res.status(401).json({ message: 'Access token is required' });
        }

        if (!startTime || !endTime) {
            return res.status(400).json({ message: 'Start time and end time are required' });
        }

        const events = await calendarService.getEvents(accessToken, startTime, endTime);
        res.json(events);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ message: 'Error fetching calendar events', error: error.message });
    }
});

// Get busy times from Google Calendar
router.get('/:userEmail/busy-times', async (req, res) => {
    try {
        const { accessToken } = req.headers;
        const { startTime, endTime } = req.query;

        if (!accessToken) {
            return res.status(401).json({ message: 'Access token is required' });
        }

        if (!startTime || !endTime) {
            return res.status(400).json({ message: 'Start time and end time are required' });
        }

        const busyTimes = await calendarService.getBusyTimes(accessToken, startTime, endTime);
        res.json(busyTimes);
    } catch (error) {
        console.error('Error fetching busy times:', error);
        res.status(500).json({ message: 'Error fetching busy times', error: error.message });
  }
});

module.exports = router;