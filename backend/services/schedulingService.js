/**
 * Scheduling Service
 * 
 * This service contains the logic for finding optimal meeting times
 * based on participants' availability schedules.
 */

// Constants for availability scores
const AVAILABILITY_SCORES = {
  'available': 2,   // Green - Preferred
  'if-needed': 1,   // Yellow - If needed
  'unavailable': 0  // Red - Unavailable
};

// Days of the week
const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

// Convert date string to day of week using pure UTC
function getDay(dateString) {
  console.log('Getting day of week for date (pure UTC):', dateString);
  const date = new Date(dateString);
  // Use UTC methods to ensure consistency across the application
  const dayIndex = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1; // Adjust for Sunday
  const day = DAYS_OF_WEEK[dayIndex];
  console.log('Day of week is (pure UTC):', day, '(index:', dayIndex, ')');
  console.log('UTC date used:', date.toISOString());
  return day;
}

// Format date for display in UTC
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

// Format time for display in UTC
function formatTime(time) {
  // Keep 24-hour format and add UTC label
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes} UTC`;
}

// Find optimal meeting times based on participant schedules
function findOptimalMeetingTimes(schedules, meetingDate, durationMinutes) {
  try {
    console.log('Finding optimal meeting times with parameters:', { meetingDate, durationMinutes });
    console.log('Number of schedules provided:', schedules.length);
    
    // Log schedule details for debugging
    schedules.forEach((schedule, index) => {
      console.log(`Schedule ${index + 1}:`, {
        userId: schedule.userId,
        userName: schedule.userName,
        userEmail: schedule.userEmail,
        availabilityDays: schedule.availability ? Object.keys(schedule.availability) : 'No availability'
      });
    });
    
    // Use a single date instead of a range
    const date = new Date(meetingDate);
    
    // Time slots to check (9 AM to 5 PM)
    const timeSlots = [
      '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
    ];
    
    // Store all possible meeting slots with scores
    const meetingSlots = [];
    
    // Get the day of week for this date
    console.log('Date for meeting:', date.toISOString());
    const dayOfWeek = getDay(date.toISOString());
    console.log('Day of week determined:', dayOfWeek);
    
    // Check each time slot
    for (let i = 0; i < timeSlots.length; i++) {
      // Skip if not enough time slots left for the meeting duration
      if (i + (durationMinutes / 60) > timeSlots.length) {
        continue;
      }
      
      const startTime = timeSlots[i];
      const endTimeIndex = i + Math.ceil(durationMinutes / 60);
      const endTime = timeSlots[endTimeIndex] || '18:00';
      
      // Calculate availability for each participant
      const participantAvailability = [];
      
      for (const schedule of schedules) {
        const userAvailability = {
          userId: schedule.userId,
          userName: schedule.userName,
          userEmail: schedule.userEmail,
          status: 'unavailable' // Default to unavailable
        };
        
        // Check if user has availability for this day
        if (schedule.availability && schedule.availability[dayOfWeek]) {
          // Calculate average availability across the meeting duration
          let totalScore = 0;
          let slotsChecked = 0;
          
          for (let j = i; j < endTimeIndex; j++) {
            const timeSlot = timeSlots[j];
            const availability = schedule.availability[dayOfWeek][timeSlot] || 'unavailable';
            totalScore += AVAILABILITY_SCORES[availability];
            slotsChecked++;
          }
          
          const avgScore = totalScore / slotsChecked;
          
          // Determine overall availability status
          if (avgScore >= 1.5) {
            userAvailability.status = 'available';
          } else if (avgScore >= 0.5) {
            userAvailability.status = 'if-needed';
          }
        }
        
        participantAvailability.push(userAvailability);
      }
      
      // Calculate overall meeting score
      const availableCount = participantAvailability.filter(p => p.status === 'available').length;
      const ifNeededCount = participantAvailability.filter(p => p.status === 'if-needed').length;
      const unavailableCount = participantAvailability.filter(p => p.status === 'unavailable').length;
      
      // Score formula: (2 * available + if-needed) / (2 * total participants)
      const score = (2 * availableCount + ifNeededCount) / (2 * participantAvailability.length);
      
      // Log availability details for debugging
      console.log(`Time slot ${startTime}-${endTime} score:`, score);
      console.log('Available participants:', participantAvailability.filter(p => p.status === 'available').length);
      console.log('If-needed participants:', participantAvailability.filter(p => p.status === 'if-needed').length);
      console.log('Unavailable participants:', participantAvailability.filter(p => p.status === 'unavailable').length);
      
      // Add to meeting slots if score is above 0
      if (score > 0) {
        console.log(`Adding time slot ${startTime}-${endTime} with score ${score}`);
        meetingSlots.push({
          date: formatDate(date),
          day: dayOfWeek,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime),
          rawStartTime: startTime,
          rawEndTime: endTime,
          score,
          participants: {
            available: participantAvailability.filter(p => p.status === 'available'),
            ifNeeded: participantAvailability.filter(p => p.status === 'if-needed'),
            unavailable: participantAvailability.filter(p => p.status === 'unavailable')
          }
        });
      }
    }
    
    // Sort by score (highest first)
    meetingSlots.sort((a, b) => b.score - a.score);
    
    // Return only the top 3 suggestions
    console.log(`Returning top 3 meeting suggestions out of ${meetingSlots.length} possibilities`);
    return meetingSlots.slice(0, 3);
  } catch (error) {
    console.error('Error finding optimal meeting times:', error);
    throw error;
  }
}

// Generate AI-based meeting suggestions
async function generateMeetingSuggestions(participants, meetingDate, durationMinutes) {
  try {
    console.log('Generating meeting suggestions for:', { participants, meetingDate, durationMinutes });
    
    // Get schedules for all participants from Google Sheets
    const sheetsService = require('./sheetsService');
    const schedules = await sheetsService.getBatchSchedules(participants);
    
    console.log('Retrieved schedules for', schedules.length, 'participants');
    
    // If no schedules found, return empty array
    if (!schedules || schedules.length === 0) {
      console.log('No schedules found for any participants');
      return [];
    }
    
    // Find optimal meeting times
    const suggestions = findOptimalMeetingTimes(schedules, meetingDate, durationMinutes);
    
    return suggestions;
  } catch (error) {
    console.error('Error generating meeting suggestions:', error);
    throw error;
  }
}

module.exports = {
  findOptimalMeetingTimes,
  generateMeetingSuggestions,
  getDay
};