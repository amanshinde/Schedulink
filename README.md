# SmartMeet - Intelligent Meeting Scheduler

SmartMeet is an intelligent meeting scheduling application that finds the optimal meeting times based on participants' availability preferences. The application uses UTC time format consistently across all components to ensure accurate scheduling across different time zones.

## 🎨 Design Philosophy & Color Palette

SmartMeet features a futuristic, elegant design with a carefully curated color palette:

### Core Colors
- **Burgundy** (#6D3E49): Used for headers, unavailable time slots, and important UI elements
- **Caramel** (#CA995E): Used for primary buttons, available time slots, and highlight elements
- **Cream** (#F0E1DD): Used for secondary buttons, if-needed time slots, and background elements

### Complementary Colors
- **Dark Plum** (#2D1A20): A deeper shade used for backgrounds and depth effects
- **Gold Highlight** (#E5B980): A lighter accent used for highlights and gradients

### Futuristic Design Elements
- **Angular Shapes**: Asymmetric polygons and angled edges create a modern, tech-forward appearance
- **Subtle Gradients**: Strategic use of single-color gradients for depth without overwhelming the design
- **Geometric Accents**: Diamond shapes and precise geometric elements add visual interest
- **Grid Patterns**: Subtle background patterns enhance the futuristic aesthetic
- **Clean Typography**: Bold, uppercase headings with increased letter spacing for readability

This approach creates a sophisticated, future-oriented interface that maintains visual clarity while providing an engaging user experience.

## 📦 Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: Google Sheets (via Google Sheets API)
- **Integration**: Google Calendar API (for syncing availability and creating events)
- **Authentication**: JWT-based token authentication

## 🚀 Project Phases

### 🟩 Phase 1: Project Setup & User Interface
- Set up folder structure: /frontend, /backend, /public, /views
- Create basic frontend pages:
  - Landing Page
  - User Registration Page
  - Weekly Schedule Input Page (color-coded calendar)
  - Organizer Meeting Creation Page
- Use HTML/CSS/JS to enable color-coded schedule input with Red/Yellow/Green slots

### 🟨 Phase 2: Backend Setup & Google Sheets Integration
- Initialize Node.js project
- Set up Express server
- Integrate Google Sheets API:
  - Store each user's weekly availability as rows
  - Structure: Name | Day | Time Slot | Availability (R/Y/G)
- Create routes for:
  - User schedule submission
  - Fetching schedules for selected users

### 🟦 Phase 3: Meeting Scheduling Logic (AI )
- Accept from the organizer:
  - Desired date
  - Duration (e.g. 1 hour)
  - Selected participants
- Backend logic:
  - Read participant schedules from Google Sheets
  - Find overlapping green/yellow slots
  - Rank time slots by # of greens > # of yellows
  - Return top 3 suggestions

### 🟧 Phase 4: Google Calendar Integration
- Integrate Google Calendar API:
  - Allow users to authenticate with Google
  - Fetch busy slots automatically (if preferred over manual entry)
  - Create event for confirmed meeting
  - Send calendar invites to participants

### 🟥 Phase 5: Notifications & Final Touches
- Add email notifications (SendGrid/Nodemailer optional)
- UI improvements: show suggestions in a visual calendar view
- Build logic for sending "adjust request" emails to yellow slots
- Optional: add "remove red participants" fallback option

## 🖌️ UI Elements & Color Usage

### Availability Indicators
- **Available** (Caramel #CA995E): Indicates times when a user is fully available
- **If Needed** (Cream #F0E1DD): Indicates times when a user can be available if necessary
- **Unavailable** (Burgundy #6D3E49): Indicates times when a user cannot attend

### Buttons
- **Primary Buttons** (Caramel #CA995E): Used for main actions like submitting forms
- **Secondary Buttons** (Cream #F0E1DD): Used for alternative actions

### Page Elements
- **Header** (Burgundy #6D3E49): Main navigation and branding area
- **Feature Cards** (White with Caramel border): Highlight key features on the landing page
- **Meeting Indicators** (Caramel #CA995E): Show scheduled meetings on the calendar
- **Notification Badges** (Burgundy #6D3E49): Alert users to new notifications

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Google Cloud Platform account with Google Sheets API and Google Calendar API enabled
- Service account with appropriate permissions

### Google Sheets Setup
1. Create a new Google Spreadsheet
2. Create three sheets named: "Users", "Schedules", and "Meetings"
3. Set up the columns as follows:
   - Users: Name | Email | Team | Created At
   - Schedules: Email | Day | Time Slot | Availability
   - Meetings: ID | Title | Description | Start Time | End Time | Participants

### Installation
1. Clone the repository
2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Google API credentials
4. Start the backend server:
   ```
   npm start
   ```
5. Open the frontend in your browser:
   ```
   http://localhost:3001
   ```

## 📝 Usage
1. Register a new account
2. Set your weekly availability using the color-coded calendar (in UTC time)
3. Create a meeting by selecting participants and preferred date range
4. Choose from the suggested meeting times
5. Confirm the meeting to send calendar invites to all participants
6. Respond to meeting invitations with accept/reject buttons
7. View your scheduled meetings in your availability calendar

## ✨ Features

### UTC Time Format
- All date and time displays use UTC format consistently across the application
- Ensures accurate scheduling across different time zones
- Time slots in the schedule grid display 24-hour UTC format (e.g., "14:00 UTC")

### Meeting Management
- Create meetings with multiple participants
- View suggested meeting times based on participants' availability
- Accept or reject meeting invitations with attractive buttons
- View meeting details with start and end times in UTC format

### Notification System
- Receive notifications for new meeting invitations
- Get notified when meetings are updated or canceled
- All notifications include UTC timestamps
- Notifications are marked as seen when viewed and can be permanently deleted

### Schedule Display
- View your weekly availability in a color-coded grid
- See all your scheduled meetings directly in your availability calendar
- Click on meeting indicators to view detailed information
- Meetings are displayed in their correct UTC time slots

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.