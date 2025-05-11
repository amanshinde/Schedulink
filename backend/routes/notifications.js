const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheetsService');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Delete all notifications for a user
router.delete('/clear-all', async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }
    
    await sheetsService.deleteAllNotifications(userEmail);
    
    res.json({ message: 'All notifications deleted successfully' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ message: 'Error deleting notifications', error: error.message });
  }
});

// Get all notifications for the current user
router.get('/', async (req, res) => {
  try {
    const userEmail = req.user.email;
    console.log('Fetching notifications for user:', userEmail);
    
    // Check if the Notifications sheet exists
    try {
      // Get notifications from Google Sheets
      const notifications = await sheetsService.getUserNotifications(userEmail);
      console.log(`Found ${notifications.length} notifications for user ${userEmail}`);
      res.json(notifications);
    } catch (sheetError) {
      // If the sheet doesn't exist yet, return an empty array
      console.log('Notifications sheet may not exist yet:', sheetError.message);
      // Create the Notifications sheet if it doesn't exist
      try {
        await sheetsService.createNotificationsSheet();
        console.log('Created Notifications sheet');
        res.json([]);
      } catch (createError) {
        console.error('Error creating Notifications sheet:', createError);
        res.json([]);
      }
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.post('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userEmail = req.user.email;
    
    // Mark notification as read in Google Sheets
    await sheetsService.markNotificationAsRead(notificationId, userEmail);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
});

// Mark all notifications as read
router.post('/read-all', async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    // Mark all notifications as read in Google Sheets
    await sheetsService.markAllNotificationsAsRead(userEmail);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
  }
});

// Mark notifications as seen (doesn't mark as read, just acknowledges they were seen)
router.post('/seen', async (req, res) => {
  try {
    const userEmail = req.user.email;
    console.log('Marking notifications as seen for user:', userEmail);
    
    // For now, we'll just return success as this is just visual feedback
    // In a future enhancement, we could track which notifications have been seen
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as seen:', error);
    res.status(500).json({ message: 'Error marking notifications as seen', error: error.message });
  }
});

// Clear all notifications for a user
router.delete('/clear-all', async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    console.log('Clearing all notifications for user:', userEmail);
    
    // Use the dedicated function to clear all notifications
    await sheetsService.clearAllNotifications(userEmail);
    
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ message: 'Error clearing all notifications', error: error.message });
  }
});

module.exports = router;
