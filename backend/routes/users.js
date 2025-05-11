const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const sheetsService = require('../services/sheetsService');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await sheetsService.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Get a specific user
router.get('/:id', async (req, res) => {
  try {
    const user = await sheetsService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    const { name, email, team } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    const newUser = await sheetsService.createUser({ name, email, team });
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Update a user
router.put('/:id', async (req, res) => {
  try {
    const { name, email, team } = req.body;
    const updatedUser = await sheetsService.updateUser(req.params.id, { name, email, team });
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  try {
    const result = await sheetsService.deleteUser(req.params.id);
    
    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

module.exports = router;