// Google Calendar Integration via Backend API

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing Google Calendar integration');
  
  // Add click event listener for the sync button
  const syncButton = document.getElementById('sync-calendar');
  if (syncButton) {
    syncButton.disabled = false;
    syncButton.addEventListener('click', handleSyncButtonClick);
    console.log('Sync button event listener added');
  }
  
  // Update the calendar with current dates
  const { startOfWeek, endOfWeek } = updateCalendarDates();
  
  // Check if we're returning from OAuth flow
  checkForAuthResponse();
  
  // Apply locked calendar events from localStorage
  applyLockedCalendarEvents();
  
  // We'll only sync calendar events when the user explicitly clicks the sync button
  // The stored token will be used when they click the button
  const storedToken = localStorage.getItem('calendar_token');
  if (storedToken) {
    console.log('Found stored Google Calendar token, but waiting for user to click sync button');
    // We don't automatically call syncCalendarWithToken here anymore
  }
});

// Apply locked calendar events from localStorage
function applyLockedCalendarEvents() {
  // Get locked calendar events from localStorage
  const lockedEvents = JSON.parse(localStorage.getItem('lockedCalendarEvents') || '{}');
  
  // Apply each locked event to the calendar
  Object.keys(lockedEvents).forEach(day => {
    Object.keys(lockedEvents[day]).forEach(time => {
      const eventData = lockedEvents[day][time];
      
      // Find the corresponding time slot
      const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
      
      if (slot) {
        // Remove any existing availability classes
        ['available', 'if-needed', 'unavailable'].forEach(cls => {
          slot.classList.remove(cls);
        });
        
        // Set to unavailable
        slot.classList.add('unavailable');
        
        // Set the event source attribute
        slot.setAttribute('data-event-source', 'google-calendar');
        slot.setAttribute('data-locked', 'true');
        
        // Apply special styling
        slot.style.background = 'linear-gradient(135deg, #ff5252, #ff867f)';
        slot.style.color = 'white';
        slot.style.fontWeight = '500';
        slot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        slot.style.border = '1px solid #ff5252';
        slot.style.borderRadius = '4px';
        slot.style.position = 'relative';
        
        // Add lock icon to indicate this slot is locked
        const lockIcon = document.createElement('div');
        lockIcon.innerHTML = '🔒'; // Lock emoji
        lockIcon.style.position = 'absolute';
        lockIcon.style.top = '2px';
        lockIcon.style.right = '2px';
        lockIcon.style.fontSize = '10px';
        slot.appendChild(lockIcon);
        
        // Add event title as tooltip
        slot.title = eventData.eventTitle || 'Google Calendar Event';
        
        // Make the slot unselectable
        slot.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Show a popup with event details
          const existingPopup = document.querySelector('.event-popup');
          if (existingPopup) {
            existingPopup.remove();
          }
          
          const popup = document.createElement('div');
          popup.className = 'event-popup';
          popup.style.position = 'fixed';
          popup.style.top = '50%';
          popup.style.left = '50%';
          popup.style.transform = 'translate(-50%, -50%)';
          popup.style.background = 'white';
          popup.style.padding = '20px';
          popup.style.borderRadius = '8px';
          popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
          popup.style.zIndex = '1000';
          popup.style.maxWidth = '300px';
          popup.style.width = '90%';
          popup.style.textAlign = 'center';
          popup.style.color = '#333';
          
          popup.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #d32f2f;">
              <span style="margin-right: 8px;">🔒</span> Google Calendar Event
            </div>
            <div style="margin-bottom: 15px;">
              This time slot is locked due to a Google Calendar event:
              <div style="margin: 8px 0; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                <strong>${eventData.eventTitle || 'Busy'}</strong>
              </div>
            </div>
            <button style="background: #ff5252; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 15px; cursor: pointer; font-weight: bold;">
              Close
            </button>
          `;
          
          document.body.appendChild(popup);
          
          // Add close functionality
          popup.querySelector('button').addEventListener('click', function() {
            popup.remove();
          });
          
          return false;
        };
      }
    });
  });
  
  console.log('Applied locked calendar events from localStorage');
}

// Update calendar with current dates
function updateCalendarDates() {
  // Get the current week's dates
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the start of the week (Monday)
  const startOfWeek = new Date(today);
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // If today is Sunday, go back 6 days, otherwise calculate days until Monday
  startOfWeek.setDate(today.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Update date displays for each day
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach((day, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    
    // Format the date as "May 6"
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Update the date display
    const dateDisplay = document.querySelector(`.date-display[data-day="${day}"]`);
    if (dateDisplay) {
      dateDisplay.textContent = formattedDate;
      dateDisplay.classList.remove('today');
      
      // Highlight today's date
      if (date.toDateString() === today.toDateString()) {
        dateDisplay.classList.add('today');
      }
    }
  });
  
  // Update calendar header
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  updateCalendarHeader(startOfWeek, endOfWeek);
  
  // Store the current week dates in localStorage for reference
  localStorage.setItem('currentWeekStart', startOfWeek.toISOString());
  localStorage.setItem('currentWeekEnd', endOfWeek.toISOString());
  
  return { startOfWeek, endOfWeek };
}

// Check for authentication response in URL
function checkForAuthResponse() {
  const urlParams = new URLSearchParams(window.location.search);
  const authStatus = urlParams.get('calendar_auth');
  const token = urlParams.get('token');
  const email = urlParams.get('email');
  
  if (authStatus === 'success' && token) {
    console.log('Successfully authenticated with Google Calendar');
    // Store the token in localStorage for persistence across page refreshes
    localStorage.setItem('calendar_token', token);
    // Also store the sync timestamp to know when we last synced
    localStorage.setItem('calendar_last_sync', new Date().toISOString());
    
    // Store the user email with the token for context
    if (email) {
      localStorage.setItem('calendar_user_email', email);
      console.log('Stored calendar token for user:', email);
    }
    
    // Get current week dates and sync calendar with the token
    const { startOfWeek, endOfWeek } = updateCalendarDates();
    syncCalendarWithToken(token, startOfWeek, endOfWeek);
    
    // Clean up URL
    cleanupUrl();
  } else if (authStatus === 'error') {
    console.error('Error authenticating with Google Calendar');
    alert('Failed to authenticate with Google Calendar. Please try again.');
    // Clean up URL
    cleanupUrl();
  }
}

// Clean up URL parameters
function cleanupUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('calendar_auth');
  url.searchParams.delete('token');
  window.history.replaceState({}, document.title, url.toString());
}

// Handle sync button click
function handleSyncButtonClick() {
  console.log('Sync button clicked');
  const syncButton = document.getElementById('sync-calendar');
  if (syncButton) {
    syncButton.disabled = true;
    syncButton.innerHTML = '<span class="spinner"></span> Syncing...';
  }
  
  // Get the user's email from localStorage if available
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = user.email || '';
  
  // Check if we already have a token from Google login
  const storedToken = localStorage.getItem('calendar_token');
  if (storedToken) {
    console.log('Using stored Google Calendar token');
    // Use the stored token
    const { startOfWeek, endOfWeek } = updateCalendarDates();
    syncCalendarWithToken(storedToken, startOfWeek, endOfWeek);
  } else {
    // Start the auth flow
    startAuthFlow(userEmail);
  }
}

// Start the authentication flow
async function startAuthFlow(userEmail = '') {
  console.log('Starting Google Calendar auth flow');
  
  try {
    // First, check if we have a valid token
    const storedToken = localStorage.getItem('calendar_token');
    
    if (storedToken) {
      // Validate the token with the backend
      const validateResponse = await fetch(`/api/auth/google/validate?token=${storedToken}`);
      const validateData = await validateResponse.json();
      
      if (validateData.valid) {
        console.log('Stored token is valid, using it');
        // Use the valid token
        const { startOfWeek, endOfWeek } = updateCalendarDates();
        syncCalendarWithToken(storedToken, startOfWeek, endOfWeek);
        return;
      } else {
        console.log('Stored token is invalid, removing it');
        localStorage.removeItem('calendar_token');
      }
    }
    
    // If no userEmail was provided, try to get it from localStorage
    if (!userEmail) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userEmail = user.email || '';
    }
    
    console.log('Using email for calendar auth:', userEmail);
    
    // No valid token, get auth URL from backend
    const response = await fetch(`/api/auth/google/calendar?email=${encodeURIComponent(userEmail)}`);
    const data = await response.json();
    
    if (data.valid && data.token) {
      // We have a valid token from the backend
      console.log('Received valid token from backend');
      localStorage.setItem('calendar_token', data.token);
      
      // Use the token
      const { startOfWeek, endOfWeek } = updateCalendarDates();
      syncCalendarWithToken(data.token, startOfWeek, endOfWeek);
    } else if (data.authUrl) {
      // Redirect to Google auth
      console.log('Redirecting to Google auth URL');
      window.location.href = data.authUrl;
    } else {
      throw new Error('Failed to get auth URL or token');
    }
  } catch (error) {
    console.error('Error in auth flow:', error);
    alert('Failed to connect to Google Calendar. Please try again.');
    
    // Reset button state
    const syncButton = document.getElementById('sync-calendar');
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.innerHTML = '<img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Calendar" width="24" height="24">Sync with Google Calendar';
    }
  }
}

// Sync calendar with token
async function syncCalendarWithToken(token, startDate, endDate) {
  const syncButton = document.getElementById('sync-calendar');
  
  try {
    // Update button state
    if (syncButton) {
      syncButton.innerHTML = '<img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Calendar" width="24" height="24">Syncing...';
    }
    
    // Use provided dates or get current week's dates in UTC
    const startOfWeek = startDate || (() => {
      const today = new Date();
      // Create a UTC date
      const start = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - today.getUTCDay() // Get start of week in UTC
      ));
      return start;
    })();
    
    const endOfWeek = endDate || (() => {
      // Create a UTC date for end of week
      const end = new Date(Date.UTC(
        startOfWeek.getUTCFullYear(),
        startOfWeek.getUTCMonth(),
        startOfWeek.getUTCDate() + 6,
        23, 59, 59, 999
      ));
      return end;
    })();
    
    console.log('Fetching calendar events from', startOfWeek.toISOString(), 'to', endOfWeek.toISOString());
    
    // Fetch events from backend API
    const response = await fetch(`/api/auth/calendar/events?token=${token}&start=${startOfWeek.toISOString()}&end=${endOfWeek.toISOString()}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error fetching calendar events');
    }
    
    const events = data.events || [];
    console.log('Calendar events fetched:', events.length);
    
    // Clear existing event indicators and tooltips
    document.querySelectorAll('.event-indicator, .event-tooltip').forEach(el => {
      el.remove();
    });
    
    // Group events by day and hour for better display
    const eventsBySlot = {};
    
    // First, organize events by day and hour
    events.forEach(event => {
      // Skip invalid events
      if (!event || !event.start) {
        console.log('Skipping invalid event:', event);
        return;
      }
      
      // Extract start and end times
      const rawStart = event.start.dateTime || event.start.date;
      const rawEnd = event.end.dateTime || event.end.date;
      
      // Skip events without valid start/end times
      if (!rawStart || !rawEnd) {
        console.log('Skipping event without valid times:', event);
        return;
      }
      
      // Parse dates correctly with time zone handling
      // For UTC times (ending with Z), we need to handle them specially
      const start = new Date(rawStart);
      const end = new Date(rawEnd);
      
      // Log the event details for debugging
      console.log('Processing event:', event.summary);
      console.log('  Raw start:', rawStart);
      console.log('  Raw end:', rawEnd);
      console.log('  Parsed start:', start.toISOString());
      console.log('  Local time start:', start.toString());
      
      // For UTC times (Z suffix), we need to manually adjust the hours
      // to match what the user expects to see in their local calendar
      let startHour, endHour;
      
      if (rawStart.endsWith('Z')) {
        // For UTC times, use the UTC hours directly without conversion
        startHour = start.getUTCHours();
        endHour = end.getUTCHours() || (startHour + 1);
        
        console.log(`  Using UTC hours directly: ${startHour}:00 to ${endHour}:00`);
      } else {
        // For non-UTC times, use the local hours
        startHour = start.getHours();
        endHour = end.getHours() || (startHour + 1);
      }
      
      // Define days array first
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Determine the day based on UTC time directly for UTC events
      let dayIndex;
      if (rawStart.endsWith('Z')) {
        dayIndex = start.getUTCDay(); // Use UTC day directly for UTC events
        console.log(`  Using UTC day directly: ${days[dayIndex]}`);
      } else {
        dayIndex = start.getDay(); // Use local day for non-UTC events
      }
      const day = days[dayIndex];
      
      console.log(`  Mapped to: ${day} from ${startHour}:00 to ${endHour}:00`);
      
      // Add event to each affected time slot
      for (let hour = startHour; hour < endHour; hour++) {
        const slotKey = `${day}-${hour}:00`;
        if (!eventsBySlot[slotKey]) {
          eventsBySlot[slotKey] = [];
        }
        
        // Store the raw time strings and formatted times for display
        const formattedStartTime = rawStart.endsWith('Z') ? 
          `${startHour}:00` : 
          start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          
        const formattedEndTime = rawEnd.endsWith('Z') ? 
          `${endHour}:00` : 
          end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        eventsBySlot[slotKey].push({
          title: (event && event.summary) ? event.summary : 'Busy',
          formattedStartTime: formattedStartTime,
          formattedEndTime: formattedEndTime
        });
      }
    });
    
    // Now display all events in their respective slots
    Object.keys(eventsBySlot).forEach(slotKey => {
      const [day, time] = slotKey.split('-');
      const timeSlot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
      
      if (timeSlot) {
        // Get events for this slot
        const slotEvents = eventsBySlot[slotKey];
        
        // Mark the time slot as unavailable with a more attractive style
        // First remove any existing availability classes
        ['available', 'if-needed', 'unavailable'].forEach(cls => {
            timeSlot.classList.remove(cls);
        });
        
        // Always add 'unavailable' class for Google Calendar events
        timeSlot.classList.add('unavailable');
        timeSlot.classList.add('calendar-event');
        
        // Mark as locked
        timeSlot.setAttribute('data-locked', 'true');
        
        // Apply gradient background instead of flat color
        timeSlot.style.background = 'linear-gradient(135deg, #ff5252, #ff867f)';
        timeSlot.style.color = 'white';
        timeSlot.style.fontWeight = '500';
        timeSlot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        timeSlot.style.border = '1px solid #ff5252';
        timeSlot.style.borderRadius = '4px';
        timeSlot.style.margin = '1px';
        timeSlot.style.display = 'flex';
        timeSlot.style.flexDirection = 'column';
        timeSlot.style.justifyContent = 'center';
        timeSlot.style.transition = 'all 0.3s ease';
        
        // Clear any existing content and add the event title
        timeSlot.innerHTML = '';
        
        // If there are multiple events, show count with icon
        if (slotEvents.length > 1) {
          const eventContainer = document.createElement('div');
          eventContainer.style.display = 'flex';
          eventContainer.style.flexDirection = 'column';
          eventContainer.style.alignItems = 'center';
          eventContainer.style.justifyContent = 'center';
          eventContainer.style.height = '100%';
          eventContainer.style.padding = '4px';
          
          const eventIcon = document.createElement('div');
          eventIcon.innerHTML = '🔒'; // Lock icon instead of calendar
          eventIcon.style.fontSize = '14px';
          eventIcon.style.marginBottom = '2px';
          
          const eventText = document.createElement('div');
          eventText.className = 'event-text';
          eventText.textContent = `${slotEvents.length} Events`;
          eventText.style.fontSize = '11px';
          eventText.style.fontWeight = 'bold';
          
          eventContainer.appendChild(eventIcon);
          eventContainer.appendChild(eventText);
          timeSlot.appendChild(eventContainer);
        } else if (slotEvents.length === 1) {
          // Show the event title directly in the slot with an icon
          const eventContainer = document.createElement('div');
          eventContainer.style.display = 'flex';
          eventContainer.style.flexDirection = 'column';
          eventContainer.style.alignItems = 'center';
          eventContainer.style.justifyContent = 'center';
          eventContainer.style.height = '100%';
          eventContainer.style.padding = '4px';
          
          const eventIcon = document.createElement('div');
          eventIcon.innerHTML = '🔒'; // Lock icon to indicate unavailable
          eventIcon.style.fontSize = '14px';
          eventIcon.style.marginBottom = '2px';
          
          const eventText = document.createElement('div');
          eventText.className = 'event-text';
          eventText.textContent = slotEvents[0].title;
          eventText.style.fontSize = '11px';
          eventText.style.fontWeight = 'bold';
          eventText.style.textAlign = 'center';
          eventText.style.overflow = 'hidden';
          eventText.style.textOverflow = 'ellipsis';
          eventText.style.whiteSpace = 'nowrap';
          eventText.style.maxWidth = '100%';
          
          eventContainer.appendChild(eventIcon);
          eventContainer.appendChild(eventText);
          timeSlot.appendChild(eventContainer);
        }
        
        // Add data attribute to mark as Google Calendar event
        timeSlot.setAttribute('data-event-source', 'google-calendar');
        
        // Update the user's schedule to mark this slot as unavailable from Google Calendar
        // Pass the event title to store with the event - safely check if event and event.summary exist
        const eventTitle = event && event.summary ? event.summary : 'Calendar Event';
        updateScheduleWithCalendarEvent(day, time, eventTitle);
        
        // Make the slot unselectable (since it's unavailable)
        timeSlot.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Create a more attractive popup instead of a basic alert
          const existingPopup = document.querySelector('.event-popup');
          if (existingPopup) {
            existingPopup.remove();
          }
          
          const popup = document.createElement('div');
          popup.className = 'event-popup';
          popup.style.position = 'fixed';
          popup.style.top = '50%';
          popup.style.left = '50%';
          popup.style.transform = 'translate(-50%, -50%)';
          popup.style.background = 'white';
          popup.style.padding = '20px';
          popup.style.borderRadius = '8px';
          popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
          popup.style.zIndex = '1000';
          popup.style.maxWidth = '300px';
          popup.style.width = '90%';
          popup.style.textAlign = 'center';
          popup.style.color = '#333';
          
          // Add event details to the popup
          const eventDetails = slotEvents.map(event => `<div style="margin: 8px 0; padding: 8px; background: #f9f9f9; border-radius: 4px;"><strong>${event.title}</strong><br>${event.formattedStartTime} - ${event.formattedEndTime}</div>`).join('');
          
          popup.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #d32f2f;">
              <span style="margin-right: 8px;">🔒</span> Time Slot Unavailable
            </div>
            <div style="margin-bottom: 15px;">
              This time slot is unavailable due to the following event(s):
            </div>
            ${eventDetails}
            <button style="background: #ff5252; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 15px; cursor: pointer; font-weight: bold;">
              Close
            </button>
          `;
          
          document.body.appendChild(popup);
          
          // Add close functionality
          popup.querySelector('button').addEventListener('click', function() {
            popup.remove();
          });
          
          // Also close when clicking outside
          document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target)) {
              popup.remove();
              document.removeEventListener('click', closePopup);
            }
          });
          
          return false;
        };
        
        // Add hover effect for better user experience
        timeSlot.addEventListener('mouseenter', function() {
          this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          this.style.transform = 'translateY(-2px)';
        });
        
        timeSlot.addEventListener('mouseleave', function() {
          this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          this.style.transform = 'translateY(0)';
        });
      }
    });
    
    console.log('Calendar sync completed successfully');
    
    alert('Successfully synced with Google Calendar! Found ' + events.length + ' events.');
  } catch (error) {
    console.error('Error syncing with Google Calendar:', error);
    alert('Failed to sync with Google Calendar: ' + error.message);
    // Clear token if there was an error
    sessionStorage.removeItem('calendar_token');
  } finally {
    // Reset button state
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.innerHTML = '<img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Calendar" width="24" height="24">Sync with Google Calendar';
    }
  }
}

// Format time for display with proper time zone handling
function formatTime(date) {
  // Ensure we're using the local time zone for display
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use local time zone
  });
}

// Update the user's schedule in localStorage to include the event source
function updateScheduleWithCalendarEvent(day, time, eventTitle) {
  console.log(`Updating schedule for ${day} at ${time} with event: ${eventTitle}`);

  // Get current schedule from localStorage
  let schedule = {};
  const storedSchedule = localStorage.getItem('userSchedule');
  if (storedSchedule) {
    schedule = JSON.parse(storedSchedule);
  }

  // Initialize day if not exists
  if (!schedule[day]) {
    schedule[day] = {};
  }

  // Set the time slot to unavailable with event source
  schedule[day][time] = {
    status: 'unavailable', // Always set Google Calendar events as unavailable
    eventSource: 'google-calendar',
    eventTitle: eventTitle,
    locked: true // Mark as locked
  };

  // Save the updated schedule back to localStorage
  localStorage.setItem('userSchedule', JSON.stringify(schedule));
  console.log(`Updated schedule for ${day} at ${time} to unavailable (Google Calendar)`);

  // Store in the permanent locked slots storage too
  storeLockedCalendarEvent(day, time, eventTitle);

  // Also update the UI to reflect this change
  const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
  if (slot) {
    // Remove any existing availability classes
    ['available', 'if-needed', 'unavailable'].forEach(cls => {
      slot.classList.remove(cls);
    });

    // Set to unavailable
    slot.classList.add('unavailable');

    // Set the event source attribute
    slot.setAttribute('data-event-source', 'google-calendar');
    slot.setAttribute('data-locked', 'true');

    // Apply special styling
    slot.style.background = 'linear-gradient(135deg, #ff5252, #ff867f)';
    slot.style.color = 'white';
    slot.style.fontWeight = '500';
    slot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    slot.style.border = '1px solid #ff5252';
    slot.style.borderRadius = '4px';
    slot.style.position = 'relative';

    // Add lock icon to indicate this slot is locked
    const lockIcon = document.createElement('div');
    lockIcon.innerHTML = '🔒'; // Lock emoji
    lockIcon.style.position = 'absolute';
    lockIcon.style.top = '2px';
    lockIcon.style.right = '2px';
    lockIcon.style.fontSize = '10px';
    slot.appendChild(lockIcon);

    // Add event title as tooltip
    slot.title = eventTitle || 'Google Calendar Event';
    
    // Make the slot unselectable (since it's unavailable)
    slot.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Show a popup with event details
      const existingPopup = document.querySelector('.event-popup');
      if (existingPopup) {
        existingPopup.remove();
      }
      
      const popup = document.createElement('div');
      popup.className = 'event-popup';
      popup.style.position = 'fixed';
      popup.style.top = '50%';
      popup.style.left = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.background = 'white';
      popup.style.padding = '20px';
      popup.style.borderRadius = '8px';
      popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
      popup.style.zIndex = '1000';
      popup.style.maxWidth = '300px';
      popup.style.width = '90%';
      popup.style.textAlign = 'center';
      popup.style.color = '#333';
      
      popup.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #d32f2f;">
          <span style="margin-right: 8px;">🔒</span> Google Calendar Event
        </div>
        <div style="margin-bottom: 15px;">
          This time slot is locked due to a Google Calendar event:
          <div style="margin: 8px 0; padding: 8px; background: #f9f9f9; border-radius: 4px;">
            <strong>${eventTitle || 'Busy'}</strong>
          </div>
        </div>
        <button style="background: #ff5252; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 15px; cursor: pointer; font-weight: bold;">
          Close
        </button>
      `;
      
      document.body.appendChild(popup);
      
      // Add close functionality
      popup.querySelector('button').addEventListener('click', function() {
        popup.remove();
      });
      
      return false;
    };
  }
}

// Store Google Calendar event in the locked slots storage
function storeLockedCalendarEvent(day, time, eventTitle) {
  // Get current locked slots from localStorage
  let lockedSlots = {};
  const storedSlots = localStorage.getItem('lockedCalendarEvents');
  if (storedSlots) {
    lockedSlots = JSON.parse(storedSlots);
  }
  
  // Initialize day if not exists
  if (!lockedSlots[day]) {
    lockedSlots[day] = {};
  }
  
  // Set the time slot as locked with event info
  lockedSlots[day][time] = {
    eventSource: 'google-calendar',
    eventTitle: eventTitle || 'Busy',
    timestamp: new Date().toISOString()
  };
  
  // Save back to localStorage
  localStorage.setItem('lockedCalendarEvents', JSON.stringify(lockedSlots));
  console.log(`Stored locked calendar event for ${day} at ${time}`);
}

// Function removed - auto-save functionality disabled as per user request

// Update calendar header with current date range
function updateCalendarHeader(startDate, endDate) {
  const dateRangeElement = document.getElementById('calendar-date-range');
  if (dateRangeElement) {
    const startFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFormatted = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dateRangeElement.textContent = `${startFormatted} - ${endFormatted}`;
  }
}