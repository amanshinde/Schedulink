// This file contains functions for locking meeting time slots

// Function to lock a meeting time slot when accepted
function lockMeetingTimeSlot(meeting) {
    try {
        console.log('Locking meeting time slot for meeting:', meeting);
        if (!meeting || !meeting.startTime) {
            console.error('Invalid meeting object or missing startTime:', meeting);
            return;
        }
        
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
        
        console.log(`Locking slot for ${day} at ${time}`);
        
        // Get current locked slots from localStorage
        let lockedSlots = {};
        const storedSlots = localStorage.getItem('lockedMeetingSlots');
        if (storedSlots) {
            try {
                lockedSlots = JSON.parse(storedSlots);
            } catch (e) {
                console.error('Error parsing stored locked slots:', e);
                lockedSlots = {};
            }
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
            endTime: meeting.endTime || new Date(startTime.getTime() + 3600000).toISOString(), // Default to 1 hour if no end time
            status: 'accepted'
        };
        
        // Save back to localStorage
        localStorage.setItem('lockedMeetingSlots', JSON.stringify(lockedSlots));
        console.log(`Stored locked meeting slot for ${day} at ${time}:`, lockedSlots[day][time]);
        
        // If we're on the schedule page, update the UI immediately
        if (window.location.pathname.includes('schedule.html')) {
            updateScheduleSlot(day, time, meeting.id);
        }
        
        return { day, time }; // Return the locked slot info for reference
    } catch (error) {
        console.error('Error locking meeting time slot:', error);
    }
}

// Helper function to update a schedule slot with locked styling
function updateScheduleSlot(day, time, meetingId) {
    // Find the corresponding time slot and lock it
    const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
    if (slot) {
        console.log('Found slot to lock on schedule page:', slot);
        
        // Remove any existing availability classes
        ['available', 'if-needed'].forEach(cls => {
            slot.classList.remove(cls);
        });
        
        // Add unavailable class
        slot.classList.add('unavailable');
        
        // Mark as locked
        slot.setAttribute('data-locked', 'true');
        slot.setAttribute('data-meeting-id', meetingId);
        
        // Apply locked styling
        slot.style.background = '#ff6b6b'; // Updated to coral/salmon red
        slot.style.color = 'white';
        slot.style.fontWeight = '500';
        slot.style.boxShadow = '0 2px 4px rgba(247, 33, 33, 0.1)';
        slot.style.border = '1px solid #ff5252'; // Updated to match coral/salmon color
        slot.style.position = 'relative';
        
        // Remove any existing lock icons
        const existingLockIcons = slot.querySelectorAll('.lock-icon');
        existingLockIcons.forEach(icon => icon.remove());
        
        // Add lock icon
        const lockIcon = document.createElement('div');
        lockIcon.className = 'lock-icon';
        lockIcon.innerHTML = '🔒';
        lockIcon.style.position = 'absolute';
        lockIcon.style.top = '2px';
        lockIcon.style.right = '2px';
        lockIcon.style.fontSize = '10px';
        slot.appendChild(lockIcon);
    } else {
        console.warn(`Could not find slot for ${day} at ${time} on schedule page`);
    }
}

// Function to sync all meeting slots based on current meetings
function syncMeetingSlots(meetings) {
    // Get the current user's email
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser || !currentUser.email) return;
    
    console.log('Syncing meeting slots for user:', currentUser.email);
    
    // Clear existing locked slots to start fresh
    clearAllLockedSlots();
    
    // Filter for meetings where the current user is a participant and has accepted
    const acceptedMeetings = meetings.filter(meeting => {
        // Skip deleted meetings
        if (meeting.status === 'deleted') return false;
        
        // Check if this user is a participant and has accepted
        if (!meeting.participants) return false;
        
        const userParticipation = meeting.participants.find(p => 
            p.email === currentUser.email && p.status === 'accepted'
        );
        
        return userParticipation || meeting.status === 'confirmed';
    });
    
    console.log(`Found ${acceptedMeetings.length} accepted meetings to lock`);
    
    // Lock each accepted meeting's time slot
    acceptedMeetings.forEach(meeting => {
        lockMeetingTimeSlot(meeting);
    });
    
    return acceptedMeetings.length;
}

// Function to clear all locked slots and start fresh
function clearAllLockedSlots() {
    console.log('Clearing all locked meeting slots');
    localStorage.setItem('lockedMeetingSlots', JSON.stringify({}));
    
    // If we're on the schedule page, reset all slots
    if (window.location.pathname.includes('schedule.html')) {
        document.querySelectorAll('.time-slot[data-locked="true"]').forEach(slot => {
            const day = slot.getAttribute('data-day');
            const time = slot.getAttribute('data-time');
            resetScheduleSlot(day, time);
        });
    }
}

// Function to apply locked slots from localStorage to the schedule grid
function applyLockedSlotsToSchedule() {
    try {
        // Get locked slots from localStorage
        const storedSlots = localStorage.getItem('lockedMeetingSlots');
        if (!storedSlots) return;
        
        const lockedSlots = JSON.parse(storedSlots);
        console.log('Applying locked slots to schedule:', lockedSlots);
        
        // Iterate through each day and time
        for (const day in lockedSlots) {
            for (const time in lockedSlots[day]) {
                const slotInfo = lockedSlots[day][time];
                updateScheduleSlot(day, time, slotInfo.meetingId);
            }
        }
    } catch (error) {
        console.error('Error applying locked slots to schedule:', error);
    }
}

// Listen for page load to apply locked slots
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the schedule page
    if (window.location.pathname.includes('schedule.html')) {
        console.log('Schedule page loaded, applying locked slots');
        applyLockedSlotsToSchedule();
    }
});

// Function to unlock a meeting time slot when a meeting is deleted
function unlockMeetingTimeSlot(meeting) {
    try {
        console.log('Unlocking meeting time slot for meeting:', meeting);
        if (!meeting || !meeting.startTime) {
            console.error('Invalid meeting object or missing startTime:', meeting);
            return;
        }
        
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
        
        console.log(`Unlocking slot for ${day} at ${time}`);
        
        // Get current locked slots from localStorage
        let lockedSlots = {};
        const storedSlots = localStorage.getItem('lockedMeetingSlots');
        if (storedSlots) {
            try {
                lockedSlots = JSON.parse(storedSlots);
            } catch (e) {
                console.error('Error parsing stored locked slots:', e);
                lockedSlots = {};
            }
        }
        
        // Check if this slot is locked
        if (lockedSlots[day] && lockedSlots[day][time]) {
            // Remove the lock
            delete lockedSlots[day][time];
            
            // If day is now empty, remove it too
            if (Object.keys(lockedSlots[day]).length === 0) {
                delete lockedSlots[day];
            }
            
            // Save back to localStorage
            localStorage.setItem('lockedMeetingSlots', JSON.stringify(lockedSlots));
            console.log(`Removed lock for meeting slot on ${day} at ${time}`);
            
            // If we're on the schedule page, update the UI immediately
            if (window.location.pathname.includes('schedule.html')) {
                resetScheduleSlot(day, time);
            }
            
            // Create a custom event to notify other pages about the unlocked slot
            const event = new CustomEvent('meetingSlotUnlocked', {
                detail: { day, time }
            });
            window.dispatchEvent(event);
            
            return { day, time }; // Return the unlocked slot info for reference
        } else {
            console.log(`No locked slot found for ${day} at ${time}`);
        }
    } catch (error) {
        console.error('Error unlocking meeting time slot:', error);
    }
}

// Helper function to reset a schedule slot to default styling
function resetScheduleSlot(day, time) {
    // Find the corresponding time slot
    const slot = document.querySelector(`.time-slot[data-day="${day}"][data-time="${time}"]`);
    if (slot) {
        console.log('Found slot to unlock on schedule page:', slot);
        
        // Remove locked styling
        slot.style.background = '';
        slot.style.color = '';
        slot.style.fontWeight = '';
        slot.style.boxShadow = '';
        slot.style.border = '';
        slot.style.position = '';
        
        // Remove data attributes
        slot.removeAttribute('data-locked');
        slot.removeAttribute('data-meeting-id');
        
        // Remove any lock icons
        const lockIcons = slot.querySelectorAll('.lock-icon');
        lockIcons.forEach(icon => icon.remove());
        
        // Reset to unavailable (default state)
        slot.classList.remove('available', 'if-needed');
        slot.classList.add('unavailable');
    } else {
        console.warn(`Could not find slot for ${day} at ${time} on schedule page`);
    }
}

// Export functions for use in other files
window.lockMeetingTimeSlot = lockMeetingTimeSlot;
window.unlockMeetingTimeSlot = unlockMeetingTimeSlot;
window.syncMeetingSlots = syncMeetingSlots;
window.clearAllLockedSlots = clearAllLockedSlots;
window.applyLockedSlotsToSchedule = applyLockedSlotsToSchedule;
window.resetScheduleSlot = resetScheduleSlot;
