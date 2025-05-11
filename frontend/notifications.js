// Notifications system for Schedulink

// Initialize the notification system
function initializeNotifications() {
    // Check for new notifications on page load
    checkNotifications();
    
    // Set up event listeners
    setupNotificationListeners();
    
    // Check for new notifications every minute
    setInterval(checkNotifications, 60000);
}

// Set up event listeners for notification interactions
function setupNotificationListeners() {
    console.log('Setting up notification listeners');
    // Toggle notification dropdown
    const notificationIcon = document.getElementById('notification-icon');
    const notificationDropdown = document.getElementById('notification-dropdown');
    
    if (notificationIcon && notificationDropdown) {
        console.log('Notification elements found, adding click handler');
        notificationIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Notification icon clicked');
            
            // Force show the dropdown instead of toggling
            notificationDropdown.style.display = 'block';
            notificationDropdown.classList.add('show');
            console.log('Dropdown visibility set to show');
            
            // Mark notifications as seen
            markNotificationsAsSeen();
        });
    } else {
        console.error('Notification elements not found:', {
            icon: notificationIcon ? 'Found' : 'Not found',
            dropdown: notificationDropdown ? 'Found' : 'Not found'
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (notificationDropdown && 
            !notificationDropdown.contains(e.target) && 
            e.target !== notificationIcon && 
            !e.target.closest('#notification-icon')) {
            console.log('Clicking outside, hiding dropdown');
            notificationDropdown.style.display = 'none';
            notificationDropdown.classList.remove('show');
        }
    });
    
    // Mark all as read button
    const markAllReadBtn = document.getElementById('mark-all-read');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function() {
            markAllNotificationsAsRead();
        });
    }
}

// Check for new notifications from the server
async function checkNotifications() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No authentication token found');
            return;
        }
        
        const response = await fetch('http://localhost:3001/api/notifications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch notifications');
        }
        
        const notifications = await response.json();
        
        // Update notification badge
        updateNotificationBadge(notifications.filter(n => !n.read).length);
        
        // Update notification list
        updateNotificationList(notifications);
        
        return notifications;
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Update the notification badge count
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Update the notification list in the dropdown
function updateNotificationList(notifications) {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="empty-notification">No notifications</div>';
        return;
    }
    
    // Sort notifications by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Generate HTML for notifications
    let html = '';
    
    notifications.forEach(notification => {
        const date = new Date(notification.timestamp);
        // Format date and time in UTC
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC`;
        
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        }) + ' ' + formattedTime;
        
        html += `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon ${notification.type}">
                    <i class="fas ${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-header">
                        <h4>${notification.title}</h4>
                        <span class="notification-time">${formattedDate}</span>
                    </div>
                    <p>${notification.message}</p>
                    ${notification.meetingId ? `<a href="meetings.html" class="notification-action">View Meeting</a>` : ''}
                </div>
                <button class="mark-read-btn" title="Mark as read" onclick="markNotificationAsRead('${notification.id}')">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        `;
    });
    
    notificationList.innerHTML = html;
    
    // Add event listeners for notification items
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.classList.contains('mark-read-btn') && 
                !e.target.closest('.mark-read-btn')) {
                const notificationId = this.dataset.id;
                markNotificationAsRead(notificationId);
                
                // If there's a meeting ID, navigate to the meetings page
                const meetingLink = this.querySelector('.notification-action');
                if (meetingLink) {
                    window.location.href = meetingLink.getAttribute('href');
                }
            }
        });
    });
}

// Get the appropriate icon for the notification type
function getNotificationIcon(type) {
    switch (type) {
        case 'success':
            return 'fa-check-circle';
        case 'warning':
            return 'fa-exclamation-triangle';
        case 'error':
            return 'fa-times-circle';
        case 'info':
        default:
            return 'fa-info-circle';
    }
}

// Mark notifications as seen (update UI only)
function markNotificationsAsSeen() {
    document.querySelectorAll('.notification-item.unread').forEach(item => {
        item.classList.add('seen');
    });
}

// Mark a specific notification as read
async function markNotificationAsRead(notificationId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark notification as read');
        }
        
        // Update UI
        const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.classList.remove('unread');
            notificationItem.classList.add('read');
        }
        
        // Refresh notifications
        checkNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('http://localhost:3001/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark all notifications as read');
        }
        
        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
        });
        
        // Update badge
        updateNotificationBadge(0);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Add a notification to the local list (for immediate feedback)
function addNotification(title, message, type = 'info') {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    // Remove empty notification message if it exists
    const emptyNotification = notificationList.querySelector('.empty-notification');
    if (emptyNotification) {
        emptyNotification.remove();
    }
    
    // Create new notification element
    const notification = document.createElement('div');
    notification.className = 'notification-item unread';
    notification.dataset.id = 'temp-' + Date.now(); // Temporary ID
    
    const timestamp = new Date();
    const formattedDate = timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    notification.innerHTML = `
        <div class="notification-icon ${type}">
            <i class="fas ${getNotificationIcon(type)}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-header">
                <h4>${title}</h4>
                <span class="notification-time">${formattedDate}</span>
            </div>
            <p>${message}</p>
        </div>
        <button class="mark-read-btn" title="Mark as read">
            <i class="fas fa-check"></i>
        </button>
    `;
    
    // Add to the top of the list
    notificationList.insertBefore(notification, notificationList.firstChild);
    
    // Update badge
    const badge = document.getElementById('notification-badge');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        updateNotificationBadge(currentCount + 1);
    }
    
    // Refresh notifications after a short delay to get the real notification from the server
    setTimeout(checkNotifications, 2000);
}

// Initialize on page load if the document is already loaded
if (document.readyState === 'complete') {
    initializeNotifications();
} else {
    document.addEventListener('DOMContentLoaded', initializeNotifications);
}
