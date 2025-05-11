// Schedule page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Initialize the schedule grid
    initializeScheduleGrid();
    
    // Load user's availability data
    loadUserAvailability();
    
    // Load meetings the user is part of
    loadUserMeetings();
    
    // Sync meeting slots based on current meetings
    const cachedMeetings = localStorage.getItem('userMeetings');
    if (cachedMeetings && typeof syncMeetingSlots === 'function') {
        try {
            console.log('Syncing meeting slots from cached meetings');
            const meetings = JSON.parse(cachedMeetings);
            syncMeetingSlots(meetings);
        } catch (error) {
            console.error('Error syncing meeting slots:', error);
            
            // Fallback to just applying locked slots from localStorage
            if (typeof applyLockedSlotsToSchedule === 'function') {
                console.log('Falling back to applying locked slots from localStorage');
                applyLockedSlotsToSchedule();
            }
        }
    } else if (typeof applyLockedSlotsToSchedule === 'function') {
        console.log('No cached meetings found, applying locked slots from localStorage');
        applyLockedSlotsToSchedule();
    } else {
        console.warn('Neither syncMeetingSlots nor applyLockedSlotsToSchedule functions are available');
    }
    
    // Add sync calendar button functionality if it exists
    const syncButton = document.getElementById('sync-calendar');
    if (syncButton) {
        syncButton.disabled = false;
    }
    
    // Listen for slot locking events from other pages
    window.addEventListener('meetingSlotLocked', function(event) {
        console.log('Received meetingSlotLocked event:', event.detail);
        const { day, time, meetingId } = event.detail;
        if (typeof updateScheduleSlot === 'function') {
            updateScheduleSlot(day, time, meetingId);
        }
    });
    
    // Listen for slot unlocking events from other pages
    window.addEventListener('meetingSlotUnlocked', function(event) {
        console.log('Received meetingSlotUnlocked event:', event.detail);
        const { day, time } = event.detail;
        if (typeof resetScheduleSlot === 'function') {
            resetScheduleSlot(day, time);
            
            // After resetting, reload user's availability to restore proper state
            loadUserAvailability();
        }
    });
})

// Initialize the schedule grid with click handlers
function initializeScheduleGrid() {
    const timeSlots = document.querySelectorAll('.time-slot');
    
    // Load locked slots from localStorage
    const lockedSlots = JSON.parse(localStorage.getItem('lockedMeetingSlots') || '{}');
    
    timeSlots.forEach(slot => {
        // Set initial state as unavailable
        slot.classList.add('unavailable');
        
        // Get day and time attributes
        const day = slot.getAttribute('data-day');
        const time = slot.getAttribute('data-time');
        
        // Check if this slot is locked due to a meeting
        const isLocked = lockedSlots[day] && lockedSlots[day][time];
        
        if (isLocked) {
            // This is a locked slot, mark it as such
            slot.setAttribute('data-locked', 'true');
            slot.setAttribute('data-meeting-id', lockedSlots[day][time].meetingId);
            
            // Apply locked styling
            slot.style.background = '#ff6b6b'; // Updated to coral/salmon red
            slot.style.color = 'white';
            slot.style.fontWeight = '500';
            slot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            slot.style.border = '1px solid #ff5252'; // Updated to match coral/salmon color
            slot.style.position = 'relative';
            
            // Add lock icon
            const lockIcon = document.createElement('div');
            lockIcon.innerHTML = '🔒';
            lockIcon.style.position = 'absolute';
            lockIcon.style.top = '2px';
            lockIcon.style.right = '2px';
            lockIcon.style.fontSize = '10px';
            slot.appendChild(lockIcon);
            
            // Create custom click handler to show meeting details
            slot.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show meeting details popup
                const meetingInfo = lockedSlots[day][time];
                showLockedMeetingDetails(meetingInfo, day, time);
                
                return false;
            };
        } else {
            // Normal slot, add click handler to cycle through availability states
            slot.addEventListener('click', function() {
                // Only allow cycling if the slot is not locked
                if (!this.hasAttribute('data-locked')) {
                    cycleAvailability(this);
                }
            });
        }
    });
}

// Show details for a locked meeting slot
function showLockedMeetingDetails(meetingInfo, day, time) {
    // Create a modal for meeting details
    const modal = document.createElement('div');
    modal.className = 'meeting-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    modal.style.zIndex = '1000';
    modal.style.maxWidth = '400px';
    modal.style.width = '80%';
    
    // Format start and end times
    const startTime = new Date(meetingInfo.startTime);
    const endTime = new Date(meetingInfo.endTime);
    
    // Create modal content
    modal.innerHTML = `
        <h3 style="margin-top: 0; color: #292828;"><span style="margin-right: 8px;">🔒</span>${meetingInfo.title}</h3>
        <p><strong>Start:</strong> ${formatDateUTC(startTime)} at ${formatTimeUTC(startTime)}</p>
        <p><strong>End:</strong> ${formatDateUTC(endTime)} at ${formatTimeUTC(endTime)}</p>
        <p><strong>Status:</strong> ${meetingInfo.status || 'Confirmed'}</p>
        <p><strong>Note:</strong> This time slot is locked because you have an accepted meeting scheduled.</p>
        <div style="margin-top: 20px; text-align: right;">
            <button id="close-modal" style="background-color: #292828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
    `;
    
    // Add modal to the page
    document.body.appendChild(modal);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    document.body.appendChild(backdrop);
    
    // Close modal when close button is clicked
    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    });
    
    // Close modal when backdrop is clicked
    backdrop.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    });
}

// Cycle through availability states: unavailable -> available -> if-needed -> unavailable
function cycleAvailability(slot) {
    // Check if the slot is locked due to a meeting or calendar event
    if (slot.hasAttribute('data-locked') || slot.getAttribute('data-event-source') === 'google-calendar') {
        // Show a message that this slot cannot be modified
        const existingPopup = document.querySelector('.locked-slot-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        const popup = document.createElement('div');
        popup.className = 'locked-slot-popup';
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
                <span style="margin-right: 8px;">🔒</span> Time Slot Locked
            </div>
            <div style="margin-bottom: 15px;">
                This time slot cannot be modified because it contains a scheduled meeting or calendar event.
            </div>
            <button style="background: #292828; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 15px; cursor: pointer; font-weight: bold;">
                Close
            </button>
        `;
        
        document.body.appendChild(popup);
        
        // Add close functionality
        popup.querySelector('button').addEventListener('click', function() {
            popup.remove();
        });
        
        return; // Exit without changing availability
    }
    
    // For non-locked slots, proceed with normal cycling
    if (slot.classList.contains('unavailable')) {
        slot.classList.remove('unavailable');
        slot.classList.add('available');
    } else if (slot.classList.contains('available')) {
        slot.classList.remove('available');
        slot.classList.add('if-needed');
    } else {
        slot.classList.remove('if-needed');
        slot.classList.add('unavailable');
    }
    
    // Clear any custom styling that might have been applied
    slot.style.background = '';
    slot.style.color = '';
    slot.style.fontWeight = '';
    slot.style.boxShadow = '';
    slot.style.border = '';
    
    // Save the updated availability
    saveUserAvailability();
}

// Load user's availability from the backend
async function loadUserAvailability() {
    try {
        const user = checkUserLogin();
        if (!user) return;
        
        const response = await fetch(`/api/availability/${user.email}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            // If no data exists yet, that's fine - we'll use the default
            if (response.status === 404) {
                console.log('No availability data found for user, using defaults');
                return;
            }
            throw new Error(`Error fetching availability: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Apply the loaded availability data to the grid
        if (data && data.availability) {
            applyAvailabilityData(data.availability);
        }
    } catch (error) {
        console.error('Error loading availability data:', error);
    }
}

// Apply availability data to the schedule grid
function applyAvailabilityData(availabilityData) {
    // Get locked slots from localStorage
    const lockedSlots = JSON.parse(localStorage.getItem('lockedMeetingSlots') || '{}');
    
    // Reset all non-locked slots to unavailable first
    document.querySelectorAll('.time-slot').forEach(slot => {
        const day = slot.getAttribute('data-day');
        const time = slot.getAttribute('data-time');
        
        // Skip locked slots
        if (lockedSlots[day] && lockedSlots[day][time]) {
            return;
        }
        
        // Skip Google Calendar events
        if (slot.getAttribute('data-event-source') === 'google-calendar') {
            return;
        }
        
        slot.classList.remove('available', 'if-needed');
        slot.classList.add('unavailable');
    });
    
    // Apply the loaded data, but respect locked slots
    availabilityData.forEach(item => {
        const { day, time, status } = item;
        const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
        
        if (slot) {
            // Skip locked slots
            if (lockedSlots[day] && lockedSlots[day][time]) {
                return;
            }
            
            // Skip Google Calendar events
            if (slot.getAttribute('data-event-source') === 'google-calendar') {
                return;
            }
            
            slot.classList.remove('available', 'if-needed', 'unavailable');
            slot.classList.add(status);
        }
    });
}

// Save user's availability to the backend
async function saveUserAvailability() {
    try {
        const user = checkUserLogin();
        if (!user) return;
        
        // Get locked slots from localStorage
        const lockedSlots = JSON.parse(localStorage.getItem('lockedMeetingSlots') || '{}');
        
        // Collect all availability data
        const availabilityData = [];
        document.querySelectorAll('.time-slot').forEach(slot => {
            const day = slot.getAttribute('data-day');
            const time = slot.getAttribute('data-time');
            
            // If this is a locked slot, always set it as unavailable
            if (lockedSlots[day] && lockedSlots[day][time]) {
                availabilityData.push({ day, time, status: 'unavailable', locked: true });
                return;
            }
            
            // If this is a Google Calendar event, always set it as unavailable
            if (slot.getAttribute('data-event-source') === 'google-calendar') {
                availabilityData.push({ day, time, status: 'unavailable', eventSource: 'google-calendar' });
                return;
            }
            
            // For normal slots, get the current status
            let status = 'unavailable';
            
            if (slot.classList.contains('available')) {
                status = 'available';
            } else if (slot.classList.contains('if-needed')) {
                status = 'if-needed';
            }
            
            availabilityData.push({ day, time, status });
        });
        
        // Save to local storage as a backup
        localStorage.setItem('userAvailability', JSON.stringify(availabilityData));
        
        // Send to backend
        const response = await fetch('/api/availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                email: user.email,
                availability: availabilityData
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error saving availability: ${response.statusText}`);
        }
        
        console.log('Availability saved successfully');
    } catch (error) {
        console.error('Error saving availability data:', error);
        // If backend save fails, we still have the local storage backup
    }
}

// Fallback: Load from local storage if backend fails
function loadFromLocalStorage() {
    const storedData = localStorage.getItem('userAvailability');
    if (storedData) {
        try {
            const availabilityData = JSON.parse(storedData);
            applyAvailabilityData(availabilityData);
            console.log('Loaded availability from local storage');
        } catch (error) {
            console.error('Error parsing local storage data:', error);
        }
    }
}

// Load meetings that the user is part of
async function loadUserMeetings() {
    try {
        const user = checkUserLogin();
        if (!user) return;
        
        const token = localStorage.getItem('token');
        
        // Fetch meetings where the user is a participant or organizer
        const response = await fetch('http://localhost:3001/api/meetings', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error fetching meetings: ${response.statusText}`);
        }
        
        const meetings = await response.json();
        
        // Store meetings in localStorage for persistence
        localStorage.setItem('userMeetings', JSON.stringify(meetings));
        
        // Display meetings on the schedule
        displayMeetingsOnSchedule(meetings);
        
    } catch (error) {
        console.error('Error loading user meetings:', error);
        
        // If API call fails, try to load from localStorage
        const cachedMeetings = localStorage.getItem('userMeetings');
        if (cachedMeetings) {
            console.log('Loading meetings from local storage');
            displayMeetingsOnSchedule(JSON.parse(cachedMeetings));
        }
    }
}

// Display meetings on the schedule grid
function displayMeetingsOnSchedule(meetings) {
    // Create a container for meeting indicators if it doesn't exist
    let meetingContainer = document.getElementById('meeting-indicators');
    if (!meetingContainer) {
        meetingContainer = document.createElement('div');
        meetingContainer.id = 'meeting-indicators';
        meetingContainer.style.position = 'relative';
        document.querySelector('.calendar-grid').appendChild(meetingContainer);
    }
    
    // Clear any existing meeting indicators
    meetingContainer.innerHTML = '';
    
    // Process each meeting
    meetings.forEach(meeting => {
        // Only process accepted meetings
        const isAccepted = meeting.status === 'accepted' || meeting.status === 'confirmed';
        
        // Parse the meeting start time
        const startTime = new Date(meeting.startTime);
        
        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const dayIndex = startTime.getUTCDay();
        // Convert to our day format (monday, tuesday, etc.)
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const day = days[dayIndex];
        
        // Get hour in 24-hour format
        const hour = startTime.getUTCHours();
        // Format time as HH:00
        const time = `${hour}:00`;
        
        // Find the corresponding time slot
        const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
        
        if (slot) {
            // Mark the slot as locked if the meeting is accepted
            if (isAccepted) {
                // Remove any existing availability classes
                ['available', 'if-needed'].forEach(cls => {
                    slot.classList.remove(cls);
                });
                
                // Add unavailable class
                slot.classList.add('unavailable');
                
                // Mark as locked
                slot.setAttribute('data-locked', 'true');
                slot.setAttribute('data-meeting-id', meeting.id);
                
                // Disable click events for this slot
                slot.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showMeetingDetails(meeting);
                    return false;
                };
                
                // Add lock styling
                slot.style.background = '#ff6b6b'; // Updated to coral/salmon red
                slot.style.color = 'white';
                slot.style.fontWeight = '500';
                slot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                slot.style.border = '1px solid #ff5252'; // Updated to match coral/salmon color
                slot.style.position = 'relative';
                
                // Add lock icon
                const lockIcon = document.createElement('div');
                lockIcon.innerHTML = '🔒';
                lockIcon.style.position = 'absolute';
                lockIcon.style.top = '2px';
                lockIcon.style.right = '2px';
                lockIcon.style.fontSize = '10px';
                slot.appendChild(lockIcon);
                
                // Store the locked state in localStorage for persistence
                storeMeetingSlot(day, time, meeting);
            }
            
            // Create a meeting indicator
            const indicator = document.createElement('div');
            indicator.className = 'meeting-indicator';
            indicator.title = `${meeting.title} (${formatTimeUTC(startTime)})`;
            indicator.setAttribute('data-meeting-id', meeting.id);
            
            // Position the indicator over the time slot
            const slotRect = slot.getBoundingClientRect();
            
            // Add the indicator to the container
            meetingContainer.appendChild(indicator);
            
            // Style the indicator with the original colors but keep some futuristic elements
            indicator.style.position = 'absolute';
            indicator.style.left = `${slot.offsetLeft}px`;
            indicator.style.top = `${slot.offsetTop}px`;
            indicator.style.width = `${slot.offsetWidth}px`;
            indicator.style.height = `${slot.offsetHeight}px`;
            indicator.style.backgroundColor = isAccepted ? '#ff6b6b' : '#DEDADA';  // Coral/salmon if accepted, medium gray otherwise
            indicator.style.border = '2px solid #ff5252';  // Coral/salmon border
            indicator.style.zIndex = '10';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.justifyContent = 'center';
            indicator.style.color = '#FFFFFF';  // White text
            indicator.style.fontWeight = 'bold';
            indicator.style.fontSize = '12px';
            indicator.style.padding = '4px';
            indicator.style.cursor = 'pointer';
            
            // Add a short title or icon to the indicator
            indicator.innerHTML = `<span>${isAccepted ? '🔒 ' : ''}${meeting.title.substring(0, 10)}${meeting.title.length > 10 ? '...' : ''}</span>`;
            
            // Add click event to show meeting details
            indicator.addEventListener('click', () => {
                showMeetingDetails(meeting);
            });
        }
    });
}

// Store meeting slot in localStorage for persistence
function storeMeetingSlot(day, time, meeting) {
    // Get current locked slots from localStorage
    let lockedSlots = {};
    const storedSlots = localStorage.getItem('lockedMeetingSlots');
    if (storedSlots) {
        lockedSlots = JSON.parse(storedSlots);
    }
    
    // Initialize day if not exists
    if (!lockedSlots[day]) {
        lockedSlots[day] = {};
    }
    
    // Set the time slot as locked with meeting info
    lockedSlots[day][time] = {
        meetingId: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        status: meeting.status
    };
    
    // Save back to localStorage
    localStorage.setItem('lockedMeetingSlots', JSON.stringify(lockedSlots));
    console.log(`Stored locked meeting slot for ${day} at ${time}`);
}

// Format time in UTC
function formatTimeUTC(date) {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} UTC`;
}

// Show meeting details in a popup
function showMeetingDetails(meeting) {
    // Create a modal for meeting details
    const modal = document.createElement('div');
    modal.className = 'meeting-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    modal.style.zIndex = '1000';
    modal.style.maxWidth = '400px';
    modal.style.width = '80%';
    
    // Format start and end times
    const startTime = new Date(meeting.startTime);
    const endTime = new Date(meeting.endTime);
    
    // Create modal content
    modal.innerHTML = `
        <h3 style="margin-top: 0; color: #4285f4;">${meeting.title}</h3>
        <p><strong>Start:</strong> ${formatDateUTC(startTime)} at ${formatTimeUTC(startTime)}</p>
        <p><strong>End:</strong> ${formatDateUTC(endTime)} at ${formatTimeUTC(endTime)}</p>
        <p><strong>Organizer:</strong> ${meeting.organizer}</p>
        <p><strong>Status:</strong> ${meeting.status || 'Scheduled'}</p>
        <p><strong>Description:</strong> ${meeting.description || 'No description provided'}</p>
        <div style="margin-top: 20px; text-align: right;">
            <button id="close-modal" style="background-color: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
    `;
    
    // Add modal to the page
    document.body.appendChild(modal);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    document.body.appendChild(backdrop);
    
    // Close modal when close button is clicked
    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    });
    
    // Close modal when backdrop is clicked
    backdrop.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    });
}

// Format date in UTC
function formatDateUTC(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
}
