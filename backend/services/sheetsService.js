const { google } = require('googleapis');
const crypto = require('crypto');

// Initialize Google Sheets API
async function getAuthClient() {
  // In a production app, you would use a more secure method to store credentials
  // For this demo, we'll use environment variables
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const decodedPrivateKey = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs8'
  });

  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    decodedPrivateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  
  await auth.authorize();
  return auth;
}

// Get Google Sheets instance
async function getSheetsInstance() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

// Get spreadsheet ID from environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Sheet names from environment variables
const SHEETS = {
  USERS: process.env.GOOGLE_SHEET_USERS || 'Users',
  SCHEDULES: process.env.GOOGLE_SHEET_SCHEDULES || 'Schedules',
  MEETINGS: process.env.GOOGLE_SHEET_MEETINGS || 'Meetings',
  NOTIFICATIONS: process.env.GOOGLE_SHEET_NOTIFICATIONS || 'Notifications',
  CALENDAR: process.env.GOOGLE_SHEET_CALENDAR || 'Calendar'
};

// Get all users
async function getUsers() {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching users...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:D`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    return rows.map((row, index) => ({
      id: index + 2, // Row number as ID
      name: row[0],
      email: row[1],
      team: row[2] || null,
      createdAt: row[3] || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching users from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get user by ID
async function getUserById(id) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user by ID...');
    const users = await getUsers();
    return users.find(user => user.id.toString() === id.toString()) || null;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Create a new user
async function createUser(userData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching existing users...');
    const users = await getUsers();
    
    if (users.some(user => user.email === userData.email)) {
      throw new Error('User with this email already exists');
    }
    
    const createdAt = new Date().toISOString();
    
    console.log('Appending new user data:', [userData.name, userData.email, userData.team || '', createdAt]);
    
    // Append new user to the sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A:D`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[userData.name, userData.email, userData.team || '', createdAt]]
      }
    });
    
    console.log('Append response:', appendResponse.data);
    
    // Return the new user with ID
    return {
      id: users.length + 2, // New row number
      name: userData.name,
      email: userData.email,
      team: userData.team || null,
      createdAt
    };
  } catch (error) {
    console.error('Error creating user in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Update a user
async function updateUser(id, userData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user by ID...');
    const user = await getUserById(id);
    
    if (!user) {
      return null;
    }
    
    console.log('Updating user data:', [userData.name || user.name, userData.email || user.email, userData.team || user.team || '']);
    
    // Update the user in the sheet
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A${id}:C${id}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[userData.name || user.name, userData.email || user.email, userData.team || user.team || '']]
      }
    });
    
    console.log('Update response:', updateResponse.data);
    
    // Return the updated user
    return {
      ...user,
      name: userData.name || user.name,
      email: userData.email || user.email,
      team: userData.team || user.team
    };
  } catch (error) {
    console.error('Error updating user in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Delete a user
async function deleteUser(id) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user by ID...');
    const user = await getUserById(id);
    
    if (!user) {
      return null;
    }
    
    console.log('Clearing user data...');
    
    // Clear the user data in the sheet
    const clearResponse = await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A${id}:D${id}`
    });
    
    console.log('Clear response:', clearResponse.data);
    
    return true;
  } catch (error) {
    console.error('Error deleting user in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get a user's schedule
async function getUserSchedule(userId) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user schedule...');
    
    // Find the user
    const user = await getUserById(userId);
    
    if (!user) {
      return null;
    }
    
    // Get the user's schedule from the Schedules sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SCHEDULES}!A:D`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    // Filter rows for this user and format the schedule
    const userScheduleRows = rows.filter(row => row[0] === user.email);
    
    // Transform into a structured schedule object
    const schedule = {
      userId: userId,
      userEmail: user.email,
      userName: user.name,
      availability: {}
    };
    
    userScheduleRows.forEach(row => {
      const day = row[1];
      const timeSlot = row[2];
      const availability = row[3]; // 'available', 'if-needed', or 'unavailable'
      
      if (!schedule.availability[day]) {
        schedule.availability[day] = {};
      }
      
      schedule.availability[day][timeSlot] = availability;
    });
    
    return schedule;
  } catch (error) {
    console.error('Error fetching user schedule from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Update a user's schedule
async function updateUserSchedule(userId, scheduleData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user schedule...');
    
    // Find the user
    const user = await getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Delete existing schedule for this user
    // In a real app, you might want to use batch operations for better performance
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SCHEDULES}!A:D`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    const userRowIndices = [];
    
    // Find rows for this user
    rows.forEach((row, index) => {
      if (row[0] === user.email) {
        userRowIndices.push(index + 1); // +1 because sheet rows are 1-indexed
      }
    });
    
    // Clear existing schedule rows
    if (userRowIndices.length > 0) {
      for (const rowIndex of userRowIndices.reverse()) { // Reverse to avoid shifting issues
        console.log('Clearing existing schedule row...');
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.SCHEDULES}!A${rowIndex}:D${rowIndex}`
        });
      }
    }
    
    // Add new schedule
    const newRows = [];
    
    for (const day in scheduleData) {
      for (const timeSlot in scheduleData[day]) {
        newRows.push([
          user.email,
          day,
          timeSlot,
          scheduleData[day][timeSlot]
        ]);
      }
    }
    
    console.log('Appending new schedule data:', newRows);
    
    if (newRows.length > 0) {
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.SCHEDULES}!A:D`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: newRows
        }
      });
      
      console.log('Append response:', appendResponse.data);
    }
    
    // Return the updated schedule
    return {
      userId: userId,
      userEmail: user.email,
      userName: user.name,
      availability: scheduleData
    };
  } catch (error) {
    console.error('Error updating user schedule in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get a user's schedule by email
async function getUserScheduleByEmail(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user schedule...');
    
    // Get the user's schedule from the Schedules sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SCHEDULES}!A:D`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    // Filter rows for this user and format the schedule
    const userScheduleRows = rows.filter(row => row[0] === userEmail);
    
    // Transform into a structured schedule object
    const schedule = {
      userEmail: userEmail,
      availability: {}
    };
    
    userScheduleRows.forEach(row => {
      const day = row[1];
      const timeSlot = row[2];
      const availability = row[3]; // 'available', 'if-needed', or 'unavailable'
      
      if (!schedule.availability[day]) {
        schedule.availability[day] = {};
      }
      
      schedule.availability[day][timeSlot] = availability;
    });
    
    return schedule;
  } catch (error) {
    console.error('Error fetching user schedule from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Update a user's schedule by email
async function updateUserScheduleByEmail(userEmail, scheduleData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching existing schedules...');
    // Get all existing data from the Schedules sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SCHEDULES}!A:E` // Updated to include EventSource column
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    // Find all row indices that contain this user's email
    const userRowIndices = [];
    rows.forEach((row, index) => {
      if (row[0] === userEmail) {
        userRowIndices.push(index + 1); // +1 because sheet rows are 1-indexed
      }
    });
    
    console.log(`Found ${userRowIndices.length} existing rows for user ${userEmail}`);
    
    // If we found existing rows for this user, delete them first
    if (userRowIndices.length > 0) {
      // Sort indices in descending order to avoid shifting issues when deleting
      userRowIndices.sort((a, b) => b - a);
      
      // Create batch update request to delete rows
      const batchUpdateRequest = {
        requests: []
      };
      
      // Group consecutive indices to minimize delete requests
      const ranges = [];
      let currentRange = { startIndex: userRowIndices[0] - 1, endIndex: userRowIndices[0] };
      
      for (let i = 1; i < userRowIndices.length; i++) {
        if (userRowIndices[i] === userRowIndices[i-1] - 1) {
          // Consecutive row, extend the current range
          currentRange.startIndex = userRowIndices[i] - 1;
        } else {
          // Non-consecutive row, push current range and start a new one
          ranges.push(currentRange);
          currentRange = { startIndex: userRowIndices[i] - 1, endIndex: userRowIndices[i] };
        }
      }
      ranges.push(currentRange);
      
      // Add delete requests for each range
      ranges.forEach(range => {
        batchUpdateRequest.requests.push({
          deleteDimension: {
            range: {
              sheetId: 0, // Assuming Schedules is the first sheet, adjust if needed
              dimension: 'ROWS',
              startIndex: range.startIndex,
              endIndex: range.endIndex
            }
          }
        });
      });
      
      console.log('Deleting existing rows with batch update:', batchUpdateRequest);
      
      try {
        const deleteResponse = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: batchUpdateRequest
        });
        
        console.log('Delete response:', deleteResponse.data);
      } catch (deleteError) {
        console.error('Error deleting rows:', deleteError);
        // Continue with append even if delete fails
      }
    }
    
    // Prepare new schedule data
    const newRows = [];
    
    Object.entries(scheduleData).forEach(([day, slots]) => {
      Object.entries(slots).forEach(([time, availabilityData]) => {
        // Check if the availability data is an object with eventSource property
        let availability, eventSource;
        
        if (typeof availabilityData === 'object' && availabilityData !== null) {
          availability = availabilityData.status;
          eventSource = availabilityData.eventSource || '';
        } else {
          // For backward compatibility with old format
          availability = availabilityData;
          eventSource = '';
        }
        
        // Push row with all 5 columns: email, day, time, availability, eventSource
        newRows.push([userEmail, day, time, availability, eventSource]);
      });
    });
    
    console.log('Appending new schedule data:', newRows);
    
    // Append new schedule
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SCHEDULES}!A:E`, // Updated to include EventSource column
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: newRows
      }
    });
    
    console.log('Append response:', appendResponse.data);
    
    return {
      userEmail: userEmail,
      availability: scheduleData
    };
  } catch (error) {
    console.error('Error updating user schedule in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get schedules for multiple users
async function getBatchSchedules(userIdentifiers) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching batch schedules for:', userIdentifiers);
    const schedules = [];
    
    for (const identifier of userIdentifiers) {
      // Check if the identifier is an email address or a user ID
      let schedule;
      if (typeof identifier === 'string' && identifier.includes('@')) {
        // It's an email address
        console.log('Getting schedule by email:', identifier);
        schedule = await getUserScheduleByEmail(identifier);
      } else {
        // It's a user ID
        console.log('Getting schedule by ID:', identifier);
        schedule = await getUserSchedule(identifier);
      }
      
      if (schedule) {
        schedules.push(schedule);
      } else {
        console.log('No schedule found for:', identifier);
      }
    }
    
    console.log('Found schedules for', schedules.length, 'users');
    return schedules;
  } catch (error) {
    console.error('Error fetching batch schedules from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Store a meeting in Google Sheets
async function storeMeeting(meetingData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Storing meeting...');
    const { id, title, description, startTime, endTime, organizer, participants, status } = meetingData;
    
    // Format participants as JSON string
    const participantsJson = JSON.stringify(participants);
    
    console.log('Appending new meeting data:', [id, title, description || '', startTime, endTime, organizer, participantsJson, status || 'scheduled']);
    
    // Append new meeting to the sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          id,
          title,
          description || '',
          startTime,
          endTime,
          organizer,
          participantsJson,
          status || 'scheduled'
        ]]
      }
    });
    
    console.log('Append response:', appendResponse.data);
    
    return meetingData;
  } catch (error) {
    console.error('Error storing meeting in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get all meetings for a user by email
async function getUserMeetingsByEmail(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user meetings by email...');
    
    // Get all meetings from the Meetings sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A:H`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    // Filter meetings where this user is a participant or organizer
    return rows
      .filter(row => {
        // Check if user is organizer
        if (row[5] === userEmail) return true;
        
        // Check if user is in participants
        try {
          const participants = JSON.parse(row[6] || '[]');
          return participants.some(p => p.email === userEmail);
        } catch (e) {
          console.error('Error parsing participants JSON:', e);
          return false;
        }
      })
      .map(row => {
        let participants = [];
        try {
          participants = JSON.parse(row[6] || '[]');
        } catch (e) {
          console.error('Error parsing participants JSON:', e);
        }
        
        return {
          id: row[0],
          title: row[1],
          description: row[2] || '',
          startTime: row[3],
          endTime: row[4],
          organizer: row[5],
          participants,
          status: row[7] || 'scheduled'
        };
      });
  } catch (error) {
    console.error('Error fetching user meetings from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Legacy function for backward compatibility
async function getUserMeetings(userId) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user meetings...');
    const user = await getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return getUserMeetingsByEmail(user.email);
  } catch (error) {
    console.error('Error fetching user meetings from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get a specific meeting by ID
async function getMeetingById(meetingId) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching meeting by ID...');
    
    // Get all meetings from the Meetings sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A:H`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    // Find the meeting with the matching ID
    const meetingRow = rows.find(row => row[0] === meetingId);
    
    if (!meetingRow) {
      return null;
    }
    
    // Parse participants JSON
    let participants = [];
    try {
      participants = JSON.parse(meetingRow[6] || '[]');
    } catch (e) {
      console.error('Error parsing participants JSON:', e);
    }
    
    return {
      id: meetingRow[0],
      title: meetingRow[1],
      description: meetingRow[2] || '',
      startTime: meetingRow[3],
      endTime: meetingRow[4],
      organizer: meetingRow[5],
      participants,
      status: meetingRow[7] || 'scheduled'
    };
  } catch (error) {
    console.error('Error fetching meeting by ID from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Update a meeting
async function updateMeeting(meetingId, meetingData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Updating meeting...');
    
    // Get all meetings from the Meetings sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A:H`
    });
    
    const rows = response.data.values || [];
    
    // Find the meeting with the matching ID
    const meetingRowIndex = rows.findIndex(row => row[0] === meetingId);
    
    if (meetingRowIndex === -1) {
      throw new Error('Meeting not found');
    }
    
    // Format participants as JSON string
    const participantsJson = JSON.stringify(meetingData.participants);
    
    // Update the meeting in the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A${meetingRowIndex + 1}:H${meetingRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          meetingId,
          meetingData.title,
          meetingData.description || '',
          meetingData.startTime,
          meetingData.endTime,
          meetingData.organizer,
          participantsJson,
          meetingData.status || 'scheduled'
        ]]
      }
    });
    
    return meetingData;
  } catch (error) {
    console.error('Error updating meeting in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Delete a meeting
async function deleteMeeting(meetingId) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Deleting meeting...');
    
    // Get all meetings from the Meetings sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!A:H`
    });
    
    const rows = response.data.values || [];
    
    // Find the meeting with the matching ID
    const meetingRowIndex = rows.findIndex(row => row[0] === meetingId);
    
    if (meetingRowIndex === -1) {
      throw new Error('Meeting not found');
    }
    
    // Mark the meeting as deleted in the sheet by updating its status
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.MEETINGS}!H${meetingRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['deleted']]
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting meeting in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Add a notification
async function addNotification(notificationData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Adding notification...');
    const { userId, title, message, type, meetingId, read, timestamp } = notificationData;
    
    // Check if Notifications sheet exists, create it if not
    try {
      // Try to access the sheet to see if it exists
      await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.NOTIFICATIONS}!A1:H1`
      });
      console.log('Notifications sheet exists');
    } catch (sheetError) {
      // If there's an error, the sheet might not exist
      console.log('Notifications sheet may not exist, creating it...');
      await createNotificationsSheet();
      console.log('Notifications sheet created successfully');
    }
    
    // Generate a unique notification ID
    const notificationId = crypto.randomBytes(16).toString('hex');
    
    console.log('Appending new notification data:', [notificationId, userId, title, message, type, meetingId || '', read ? 'true' : 'false', timestamp]);
    
    // Append new notification to the sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          notificationId,
          userId,
          title,
          message,
          type || 'info',
          meetingId || '',
          read ? 'true' : 'false',
          timestamp
        ]]
      }
    });
    
    console.log('Append response:', appendResponse.data);
    
    return { ...notificationData, id: notificationId };
  } catch (error) {
    console.error('Error adding notification in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Get user notifications
async function getUserNotifications(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Fetching user notifications...');
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    console.log('Current spreadsheet data:', response.data);
    
    const rows = response.data.values || [];
    
    console.log('Filtering notifications for user:', userEmail);
    
    // Filter notifications for this user and exclude deleted ones
    const filteredRows = rows.filter(row => {
      // Check if this row belongs to the user
      const isUserRow = row[1] === userEmail;
      
      // Check if this notification is marked as deleted
      // Status is in column H (index 7)
      const isDeleted = row[7] === 'deleted';
      
      console.log('Row:', row[0], 'User:', row[1], 'Status:', row[7], 'Include:', isUserRow && !isDeleted);
      
      return isUserRow && !isDeleted;
    });
    
    console.log('Found', filteredRows.length, 'notifications for user after filtering');
    
    return filteredRows.map(row => ({
      id: row[0],
      userId: row[1],
      title: row[2],
      message: row[3],
      type: row[4] || 'info',
      meetingId: row[5] || null,
      read: row[6] === 'true',
      timestamp: row[7]
    }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp, newest first
  } catch (error) {
    console.error('Error fetching user notifications from Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId, userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Marking notification as read...');
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    const rows = response.data.values || [];
    
    // Find the notification with the matching ID and user
    const notificationRowIndex = rows.findIndex(row => row[0] === notificationId && row[1] === userEmail);
    
    if (notificationRowIndex === -1) {
      throw new Error('Notification not found or does not belong to user');
    }
    
    // Update the notification in the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!G${notificationRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['true']]
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Mark notification as deleted
async function markNotificationAsDeleted(notificationId, userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Marking notification as deleted for ID:', notificationId, 'User:', userEmail);
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    const rows = response.data.values || [];
    console.log('Found', rows.length, 'total notifications');
    
    // Find the notification with the matching ID and user
    const notificationRowIndex = rows.findIndex(row => row[0] === notificationId && row[1] === userEmail);
    
    if (notificationRowIndex === -1) {
      console.log('Notification not found or does not belong to user');
      return { success: false, message: 'Notification not found' };
    }
    
    console.log('Found notification at row index:', notificationRowIndex);
    
    // Update the notification in the sheet to mark it as deleted
    // We'll use column H (index 7) for the status
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!H${notificationRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['deleted']]
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as deleted in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Clear all notifications for a user
async function clearAllNotifications(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Clearing all notifications for user:', userEmail);
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    const rows = response.data.values || [];
    console.log('Found', rows.length, 'total notifications');
    
    // Find all notifications for this user
    const userNotificationIndices = [];
    rows.forEach((row, index) => {
      if (row[1] === userEmail) {
        userNotificationIndices.push(index);
      }
    });
    
    console.log('Found', userNotificationIndices.length, 'notifications for user:', userEmail);
    
    // Mark each notification as deleted
    for (const index of userNotificationIndices) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.NOTIFICATIONS}!H${index + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['deleted']]
        }
      });
    }
    
    return { success: true, count: userNotificationIndices.length };
  } catch (error) {
    console.error('Error clearing all notifications in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Marking all notifications as read...');
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    const rows = response.data.values || [];
    
    // Find all notifications for this user that are not read
    const unreadNotifications = rows
      .map((row, index) => ({ row, index }))
      .filter(item => item.row[1] === userEmail && item.row[6] !== 'true');
    
    // Update each notification
    for (const { index } of unreadNotifications) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.NOTIFICATIONS}!G${index + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['true']]
        }
      });
    }
    
    return { success: true, count: unreadNotifications.length };
  } catch (error) {
    console.error('Error marking all notifications as read in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Add event to calendar
async function addToCalendar(userEmail, eventData) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Adding event to calendar...');
    const { meetingId, title, description, startTime, endTime, eventSource } = eventData;
    
    // Generate a unique event ID
    const eventId = crypto.randomBytes(16).toString('hex');
    
    console.log('Appending new calendar event:', [eventId, userEmail, meetingId, title, description || '', startTime, endTime, eventSource || 'SmartMeet']);
    
    // Append new event to the sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CALENDAR}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          eventId,
          userEmail,
          meetingId,
          title,
          description || '',
          startTime,
          endTime,
          eventSource || 'SmartMeet'
        ]]
      }
    });
    
    console.log('Append response:', appendResponse.data);
    
    return { ...eventData, id: eventId };
  } catch (error) {
    console.error('Error adding event to calendar in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Remove event from calendar
async function removeFromCalendar(userEmail, meetingId) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Removing event from calendar...');
    
    // Get all events from the Calendar sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CALENDAR}!A:H`
    });
    
    const rows = response.data.values || [];
    
    // Find the events with the matching meeting ID and user
    const eventRowIndices = rows
      .map((row, index) => ({ row, index }))
      .filter(item => item.row[2] === meetingId && item.row[1] === userEmail)
      .map(item => item.index);
    
    if (eventRowIndices.length === 0) {
      console.log('No calendar events found for this meeting and user');
      return { success: true, count: 0 };
    }
    
    // Delete each event (by marking it as deleted)
    for (const index of eventRowIndices) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.CALENDAR}!H${index + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['deleted']]
        }
      });
    }
    
    return { success: true, count: eventRowIndices.length };
  } catch (error) {
    console.error('Error removing event from calendar in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Create Notifications sheet if it doesn't exist
async function createNotificationsSheet() {
  try {
    console.log('Creating Notifications sheet...');
    const sheets = await getSheetsInstance();
    
    // Check if the sheet already exists
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetExists = response.data.sheets.some(sheet => 
      sheet.properties.title === SHEETS.NOTIFICATIONS
    );
    
    if (sheetExists) {
      console.log('Notifications sheet already exists');
      return;
    }
    
    // Add the Notifications sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SHEETS.NOTIFICATIONS
              }
            }
          }
        ]
      }
    });
    
    // Add headers to the Notifications sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A1:H1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['ID', 'Recipient', 'Title', 'Message', 'Type', 'MeetingId', 'Read', 'Timestamp']]
      }
    });
    
    console.log('Notifications sheet created successfully');
  } catch (error) {
    console.error('Error creating Notifications sheet:', error);
    throw error;
  }
}

// Delete all notifications for a user (permanent deletion)
async function deleteAllNotifications(userEmail) {
  try {
    console.log('Getting sheets instance...');
    const sheets = await getSheetsInstance();
    
    console.log('Permanently deleting all notifications for user:', userEmail);
    
    // Get all notifications from the Notifications sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.NOTIFICATIONS}!A:H`
    });
    
    const rows = response.data.values || [];
    console.log('Found', rows.length, 'total notifications');
    
    // Find all notifications for this user
    const userNotificationIndices = [];
    rows.forEach((row, index) => {
      if (row[1] === userEmail) {
        userNotificationIndices.push(index);
      }
    });
    
    console.log('Found', userNotificationIndices.length, 'notifications for user:', userEmail);
    
    // If no notifications found, return early
    if (userNotificationIndices.length === 0) {
      return { success: true, count: 0 };
    }
    
    // Prepare batch update request
    const batchUpdateRequest = {
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'RAW',
        data: userNotificationIndices.map(index => ({
          range: `${SHEETS.NOTIFICATIONS}!H${index + 1}`,
          values: [['deleted']]
        }))
      }
    };
    
    // Execute batch update instead of individual updates
    await sheets.spreadsheets.values.batchUpdate(batchUpdateRequest);
    
    return { success: true, count: userNotificationIndices.length };
  } catch (error) {
    console.error('Error deleting all notifications in Google Sheets:', error);
    console.error('Error details:', error.response ? error.response.data : error);
    throw error;
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  getUserSchedule,
  updateUserSchedule,
  getUserScheduleByEmail,
  updateUserScheduleByEmail,
  getBatchSchedules,
  storeMeeting,
  getUserMeetings,
  getUserMeetingsByEmail,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  addNotification,
  getUserNotifications,
  markNotificationAsRead,
  markNotificationAsDeleted,
  markAllNotificationsAsRead,
  clearAllNotifications,
  deleteAllNotifications,
  addToCalendar,
  removeFromCalendar,
  createNotificationsSheet
};