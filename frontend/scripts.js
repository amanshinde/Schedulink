// Common JavaScript functionality for Schedulink

// Authentication functions
function checkUserLogin() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
    }
}

function isAuthenticated() {
    return localStorage.getItem('token') !== null && checkUserLogin() !== null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Check if user is authenticated when accessing protected pages
function checkAuth() {
    const protectedPages = ['schedule.html', 'create-meeting.html', 'meetings.html'];
    const publicPages = ['index.html', '', 'login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    console.log('Current page:', currentPage);
    console.log('Is authenticated:', isAuthenticated());
    
    if (protectedPages.includes(currentPage) && !isAuthenticated()) {
        window.location.href = 'login.html';
    } else if (publicPages.includes(currentPage) && isAuthenticated() && currentPage !== '') {
        // Redirect to schedule.html as the default dashboard page
        window.location.href = 'schedule.html';
    }
}

// Run auth check when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

// Notification system
function setupNotifications() {
    const notificationIcon = document.getElementById('notification-icon');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    if (!notificationIcon) return; // Exit if not on a page with notifications
    
    // Toggle notification dropdown
    notificationIcon.addEventListener('click', function(e) {
        e.preventDefault();
        notificationDropdown.classList.toggle('show');
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function closeDropdown(e) {
            if (!notificationIcon.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('show');
                document.removeEventListener('click', closeDropdown);
            }
        });
    });
    
    // Mark all notifications as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function() {
            const unreadItems = notificationList.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
            });
            
            // Update badge count
            updateNotificationBadge(0);
            
            // Save read status to localStorage
            const notifications = getNotifications();
            notifications.forEach(notification => {
                notification.read = true;
            });
            saveNotifications(notifications);
        });
    }
    
    // Load and display notifications
    loadNotifications();
}

// Get notifications from localStorage
function getNotifications() {
    const notificationsStr = localStorage.getItem('notifications');
    if (!notificationsStr) return [];
    
    try {
        return JSON.parse(notificationsStr);
    } catch (e) {
        console.error('Error parsing notifications:', e);
        return [];
    }
}

// Save notifications to localStorage
function saveNotifications(notifications) {
    localStorage.setItem('notifications', JSON.stringify(notifications));
}

// Add a new notification
function addNotification(title, message, type = 'info') {
    const notifications = getNotifications();
    
    // Add new notification
    notifications.unshift({
        id: Date.now(),
        title: title,
        message: message,
        type: type,
        read: false,
        timestamp: new Date().toISOString()
    });
    
    // Keep only the latest 20 notifications
    if (notifications.length > 20) {
        notifications.pop();
    }
    
    // Save to localStorage
    saveNotifications(notifications);
    
    // Reload notifications in the UI
    loadNotifications();
}

// Load notifications into the UI
function loadNotifications() {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    const notifications = getNotifications();
    
    // Clear current list
    notificationList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="empty-notification">No new notifications</div>';
        updateNotificationBadge(0);
        return;
    }
    
    // Count unread notifications
    const unreadCount = notifications.filter(n => !n.read).length;
    updateNotificationBadge(unreadCount);
    
    // Add notifications to the list
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
        notificationItem.dataset.id = notification.id;
        
        // Format the timestamp
        const timestamp = new Date(notification.timestamp);
        const timeAgo = getTimeAgo(timestamp);
        
        notificationItem.innerHTML = `
            ${notification.read ? '' : '<div class="notification-dot"></div>'}
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${timeAgo}</div>
            </div>
        `;
        
        // Mark as read when clicked
        notificationItem.addEventListener('click', function() {
            if (!notification.read) {
                notification.read = true;
                notificationItem.classList.remove('unread');
                saveNotifications(notifications);
                
                // Update badge count
                const newUnreadCount = notifications.filter(n => !n.read).length;
                updateNotificationBadge(newUnreadCount);
            }
        });
        
        notificationList.appendChild(notificationItem);
    });
}

// Update the notification badge count
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// Helper function to format time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval === 1 ? '1 year ago' : `${interval} years ago`;
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval === 1 ? '1 month ago' : `${interval} months ago`;
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval === 1 ? '1 day ago' : `${interval} days ago`;
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval === 1 ? '1 hour ago' : `${interval} hours ago`;
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval === 1 ? '1 minute ago' : `${interval} minutes ago`;
    }
    
    return seconds < 10 ? 'just now' : `${Math.floor(seconds)} seconds ago`;
}

// Redirect to login if not authenticated (only for protected pages)
function requireAuth() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['index.html', '', 'login.html', 'register.html'];
    
    if (!publicPages.includes(currentPage) && !isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Format date for display in UTC
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Format time for display in UTC
function formatTime(timeString) {
    // Parse the time string (expected format: HH:MM)
    const [hours, minutes] = timeString.split(':').map(num => parseInt(num));
    // Return formatted time in 24-hour UTC format
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC`;
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['index.html', '', 'login.html', 'register.html'];
    
    // Only check auth for non-public pages
    if (!publicPages.includes(currentPage) && !requireAuth()) return;
    
    // Display user name in the navigation
    const user = checkUserLogin();
    if (user) {
        // Find and modify the existing logout link
        const logoutLinks = document.querySelectorAll('a[onclick="logout()"]');
        logoutLinks.forEach(link => {
            // Update the text to show the user's name
            link.innerHTML = `${user.name} ▼`;
            
            // Remove the onclick attribute and add our own event listener
            link.removeAttribute('onclick');
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                if (confirm('Do you want to logout?')) {
                    logout();
                }
            });
        });
    }
    
    // Add notification functionality
    setupNotifications();
    
    // Add mobile menu toggle functionality
    const menuToggle = document.createElement('div');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.style.display = 'none';
    menuToggle.style.fontSize = '1.5rem';
    menuToggle.style.cursor = 'pointer';
    
    const header = document.querySelector('header .container');
    const nav = document.querySelector('nav');
    
    if (header && nav) {
        header.insertBefore(menuToggle, nav);
        
        // Media query for mobile
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        function handleMobileMenu(e) {
            if (e.matches) {
                menuToggle.style.display = 'block';
                nav.style.display = 'none';
                
                menuToggle.addEventListener('click', function() {
                    nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
                });
            } else {
                menuToggle.style.display = 'none';
                nav.style.display = 'block';
            }
        }
        
        // Initial check
        handleMobileMenu(mediaQuery);
        
        // Add listener for changes
        mediaQuery.addListener(handleMobileMenu);
    }
});

// Initialize Google Calendar integration
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});