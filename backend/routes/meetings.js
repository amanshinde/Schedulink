const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheetsService');
const schedulingService = require('../services/schedulingService');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Find optimal meeting times
router.post('/suggest', async (req, res) => {
  try {
    const { participants, meetingDate, duration } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: 'Participants array is required' });
    }
    
    if (!meetingDate || !duration) {
      return res.status(400).json({ message: 'Meeting date and duration are required' });
    }
    
    // Use the generateMeetingSuggestions function with real data
    console.log('Generating AI-based meeting suggestions for date:', meetingDate, 'with duration:', duration);
    
    // Remove any duplicate participants
    const uniqueParticipants = [...new Set(participants)];
    if (uniqueParticipants.length !== participants.length) {
      console.log('Removed duplicate participants. Original:', participants.length, 'Unique:', uniqueParticipants.length);
    }
    console.log('Participants:', uniqueParticipants);
    
    const suggestions = await schedulingService.generateMeetingSuggestions(
      uniqueParticipants, 
      meetingDate, 
      parseInt(duration)
    );
    
    console.log('Generated meeting suggestions:', suggestions.length);
    if (suggestions.length === 0) {
      console.log('No suitable meeting times found');
    }
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error suggesting meeting times:', error);
    res.status(500).json({ message: 'Error suggesting meeting times', error: error.message });
  }
});

// Create a meeting
router.post('/', async (req, res) => {
  try {
    const { title, description, startTime, endTime, participants } = req.body;
    const organizer = req.user.email;
    
    if (!title || !startTime || !endTime || !participants) {
      return res.status(400).json({ message: 'Title, start time, end time, and participants are required' });
    }
    
    // Generate a unique meeting ID
    const meetingId = crypto.randomBytes(16).toString('hex');
    
    // Process participants with their availability status
    const processedParticipants = await Promise.all(participants.map(async (participant) => {
      // Get participant availability from the scheduling service
      const userSchedule = await sheetsService.getUserScheduleByEmail(participant.email);
      
      // Use pure UTC time directly
      const meetingDate = new Date(startTime);
      const dayOfWeek = schedulingService.getDay(meetingDate.toISOString());
      // Extract hours and minutes directly from UTC time
      const hours = meetingDate.getUTCHours();
      const minutes = meetingDate.getUTCMinutes();
      const timeSlot = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
      console.log('Checking availability for day (UTC):', dayOfWeek, 'time slot (UTC):', timeSlot, 'from date:', meetingDate.toISOString());
      
      // Check user's availability for this time slot
      let availability = 'unavailable';
      if (userSchedule && userSchedule.availability && 
          userSchedule.availability[dayOfWeek] && 
          userSchedule.availability[dayOfWeek][timeSlot]) {
        availability = userSchedule.availability[dayOfWeek][timeSlot];
      }
      
      // Determine initial status based on availability
      let status = 'pending';
      if (participant.email === organizer) {
        status = 'accepted'; // Organizer automatically accepts
      } else if (availability === 'available') {
        status = 'accepted'; // Available users automatically accept
      } else if (availability === 'unavailable') {
        status = 'pending'; // Unavailable users need manual confirmation
      } else if (availability === 'if-needed') {
        status = 'pending'; // If-needed users need manual confirmation
      }
      
      return {
        ...participant,
        availability,
        status
      };
    }));
    
    // Store the meeting in Google Sheets
    const meeting = await sheetsService.storeMeeting({
      id: meetingId,
      title,
      description,
      startTime,
      endTime,
      organizer,
      participants: processedParticipants,
      status: 'scheduled'
    });
    
    // Create notifications for all participants
    for (const participant of processedParticipants) {
      let notificationType = 'info';
      let notificationMessage = '';
      
      if (participant.email === organizer) {
        notificationMessage = `You have created a meeting: ${title}`;
      } else if (participant.availability === 'available') {
        notificationMessage = `You have been added to a meeting: ${title}`;
        notificationType = 'success';
      } else if (participant.availability === 'if-needed') {
        notificationMessage = `You have been invited to a meeting: ${title}. Please accept or reject.`;
        notificationType = 'warning';
      } else {
        notificationMessage = `You have been invited to a meeting: ${title}, but you appear to be unavailable at this time.`;
        notificationType = 'warning';
      }
      
      // Add notification to Google Sheets
      await sheetsService.addNotification({
        userId: participant.email,
        title: 'Meeting Invitation',
        message: notificationMessage,
        type: notificationType,
        meetingId,
        read: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update calendar events for participants with 'accepted' status
    for (const participant of processedParticipants) {
      if (participant.status === 'accepted') {
        // Add to Google Calendar
        await sheetsService.addToCalendar(participant.email, {
          meetingId,
          title,
          description,
          startTime,
          endTime,
          eventSource: 'Schedulink'
        });
        
        // Mark the time slot as unavailable in the participant's schedule
        await markTimeSlotAsUnavailable(participant.email, startTime, endTime, meetingId);
      }
    }
    
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ message: 'Error creating meeting', error: error.message });
  }
});

// Get all meetings for the current user
router.get('/user', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const meetings = await sheetsService.getUserMeetingsByEmail(userEmail);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting user meetings:', error);
    res.status(500).json({ message: 'Error getting user meetings', error: error.message });
  }
});

// Respond to a meeting invitation (accept/reject)
router.post('/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const userEmail = req.user.email;
    
    if (!response || !['accepted', 'rejected'].includes(response)) {
      return res.status(400).json({ message: 'Valid response (accepted/rejected) is required' });
    }
    
    // Get the meeting
    const meeting = await sheetsService.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Find the participant
    const participantIndex = meeting.participants.findIndex(p => p.email === userEmail);
    if (participantIndex === -1) {
      return res.status(403).json({ message: 'You are not a participant in this meeting' });
    }
    
    // Update participant status
    const participant = meeting.participants[participantIndex];
    
    // Only allow if-needed users to respond
    if (participant.availability !== 'if-needed') {
      return res.status(400).json({ 
        message: `Cannot update response: your availability is ${participant.availability}, not 'if-needed'` 
      });
    }
    
    // Update the participant status
    participant.status = response;
    meeting.participants[participantIndex] = participant;
    
    // Update the meeting in Google Sheets
    await sheetsService.updateMeeting(id, meeting);
    
    // Add notification for the meeting organizer
    await sheetsService.addNotification({
      userId: meeting.organizer,
      title: 'Meeting Response',
      message: `${participant.name || participant.email} has ${response} your meeting: ${meeting.title}`,
      type: response === 'accepted' ? 'success' : 'info',
      meetingId: id,
      read: false,
      timestamp: new Date().toISOString()
    });
    
    // If accepted, add to calendar and mark time slot as unavailable
    if (response === 'accepted') {
      await sheetsService.addToCalendar(userEmail, {
        meetingId: id,
        title: meeting.title,
        description: meeting.description,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        eventSource: 'Schedulink'
      });
      
      // Mark the time slot as unavailable in the user's schedule
      await markTimeSlotAsUnavailable(userEmail, meeting.startTime, meeting.endTime, id);
    }
    
    // Check if all participants have responded
    const allResponded = meeting.participants.every(p => 
      p.status === 'accepted' || p.status === 'rejected'
    );
    
    if (allResponded) {
      // Update meeting status to confirmed
      meeting.status = 'confirmed';
      await sheetsService.updateMeeting(id, meeting);
      
      // Notify organizer that all have responded
      await sheetsService.addNotification({
        userId: meeting.organizer,
        title: 'Meeting Confirmed',
        message: `All participants have responded to your meeting: ${meeting.title}`,
        type: 'success',
        meetingId: id,
        read: false,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ success: true, message: `Meeting ${response}` });
  } catch (error) {
    console.error('Error responding to meeting:', error);
    res.status(500).json({ message: 'Error responding to meeting', error: error.message });
  }
});

// Get a specific meeting
router.get('/:id', async (req, res) => {
  try {
    const meeting = await sheetsService.getMeetingById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ message: 'Error fetching meeting', error: error.message });
  }
});

// Delete a meeting
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userEmail = req.user.email;
    
    // Get the meeting
    const meeting = await sheetsService.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check if the user is the organizer
    if (meeting.organizer !== userEmail) {
      return res.status(403).json({ message: 'Only the meeting organizer can delete a meeting' });
    }
    
    // Delete the meeting from Google Sheets
    await sheetsService.deleteMeeting(id);
    
    // Notify all participants about the cancellation
    for (const participant of meeting.participants) {
      if (participant.email !== userEmail) { // Don't notify the organizer who is canceling
        await sheetsService.addNotification({
          userId: participant.email,
          title: 'Meeting Cancelled',
          message: `Meeting Canceled`,
          type: 'warning',
          meetingId: id,
          read: false,
          timestamp: new Date().toISOString()
        });
        
        // Remove from calendar if it was added
        if (participant.status === 'accepted') {
          await sheetsService.removeFromCalendar(participant.email, id);
        }
      }
    }
    
    // Add notification for the organizer who deleted the meeting
    await sheetsService.addNotification({
      userId: userEmail,
      title: 'Meeting Deleted',
      message: `Meeting deleted`,
      type: 'info',
      meetingId: id,
      read: false,
      timestamp: new Date().toISOString()
    });
    
    // Also remove from organizer's calendar
    await sheetsService.removeFromCalendar(userEmail, id);
    
    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ message: 'Error deleting meeting', error: error.message });
  }
});

// Helper function to mark time slot as unavailable in user's schedule
async function markTimeSlotAsUnavailable(userEmail, startTime, endTime, meetingId) {
  try {
    // Get user's current schedule
    const userSchedule = await sheetsService.getUserScheduleByEmail(userEmail);
    if (!userSchedule || !userSchedule.availability) {
      console.log(`No schedule found for user ${userEmail}`);
      return;
    }
    
    // Calculate the time slots to mark as unavailable
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const dayOfWeek = schedulingService.getDay(startDate.toISOString());
    
    // Create a copy of the user's schedule to modify
    const updatedSchedule = { ...userSchedule.availability };
    
    // Ensure the day exists in the schedule
    if (!updatedSchedule[dayOfWeek]) {
      updatedSchedule[dayOfWeek] = {};
    }
    
    // Mark each hour slot as unavailable for the duration of the meeting
    let currentHour = startDate.getUTCHours();
    const endHour = endDate.getUTCHours();
    
    while (currentHour <= endHour) {
      const timeSlot = `${currentHour}:00`;
      
      // Set the slot as unavailable with the meeting ID as the event source
      updatedSchedule[dayOfWeek][timeSlot] = {
        status: 'unavailable',
        eventSource: `meeting-${meetingId}`
      };
      
      currentHour++;
    }
    
    // Update the user's schedule in the database
    await sheetsService.updateUserScheduleByEmail(userEmail, updatedSchedule);
    console.log(`Marked time slots as unavailable for user ${userEmail} for meeting ${meetingId}`);
  } catch (error) {
    console.error('Error marking time slot as unavailable:', error);
    // Don't throw the error to prevent disrupting the meeting flow
  }
}

module.exports = router;