# 📅 Calendar Integration Guide

## Overview

The Spencer McGaw Hub includes comprehensive calendar integration that syncs with Microsoft 365, Google Calendar, and supports local events. This guide will help you get started with calendar features.

---

## 🚀 Getting Started

### Connecting Your Calendar

1. **Navigate to Calendar**
   - Go to `/calendar` from the main navigation
   - Click the **Settings** icon (⚙️) in the top right

2. **Microsoft 365 / Outlook**
   - Click **"Connect Microsoft Calendar"**
   - Sign in with your Microsoft account
   - Authorize the following permissions:
     - Calendars.Read - View your calendar
     - Calendars.ReadWrite - Create and edit events
     - Contacts.Read - Access contact information
     - Mail.Read, Mail.Send - Email integration
   - You'll be redirected back to the app with a success message

3. **Google Calendar**
   - Click **"Connect Google Calendar"**
   - Sign in with your Google account
   - Grant calendar access permissions
   - Sync will begin automatically

---

## ✨ Features

### 1. **Multiple Calendar Views**

- **Month View** - Traditional month calendar with event overview
- **Week View** - Detailed week schedule with hourly breakdown
- **Day View** - Single day focus with 30-minute time slots
- **Agenda View** - List of upcoming events

**Switch views:** Use the view toggle in the top navigation bar

### 2. **Create Events**

**Quick Create:**
1. Click the **+ New Event** button
2. Fill in event details:
   - Title (required)
   - Start/end date and time
   - Location (optional)
   - Description (optional)
   - Attendees (optional)
3. Click **Create Event**

**Create from Calendar:**
- Click on any time slot in Week/Day view
- Event dialog opens with pre-filled time
- Complete details and save

### 3. **Edit & Delete Events**

**Edit Event:**
1. Click on any event in the calendar
2. Click the **Edit** icon
3. Modify details
4. Click **Save Changes**

**Delete Event:**
1. Click on the event
2. Click the **Delete** icon (trash can)
3. Confirm deletion

### 4. **Event Types & Colors**

Events are automatically color-coded by type:
- 🔵 **Blue** - Meetings
- 🟢 **Green** - Appointments
- 🟡 **Yellow** - Deadlines
- 🔴 **Red** - Urgent/Priority
- 🟣 **Purple** - Personal

**Change event color:**
- Edit the event
- Select a different color from the color picker

### 5. **Client Meeting Integration**

**Schedule client meetings:**
1. Click **+ New Event**
2. Select **"Client Meeting"** as event type
3. Link to a client from the dropdown
4. The event will appear on both the calendar and the client's record

**Benefits:**
- Automatically links to client record
- Shows in client activity timeline
- Syncs with client tasks

### 6. **Task Deadline Sync**

Tasks with due dates automatically appear on your calendar:
- Shows as all-day events on the due date
- Color-coded by priority
- Click to view/edit the task

**Enable/disable task sync:**
- Go to Calendar Settings
- Toggle "Show task deadlines on calendar"

### 7. **AI-Powered Scheduling**

**Smart scheduling suggestions:**
1. Click the **Sparkles** icon (✨)
2. Describe what you want to schedule:
   - "Schedule a 30-minute meeting with John next Tuesday"
   - "Find time for a team standup this week"
3. AI suggests available time slots
4. Review and confirm

**How it works:**
- Analyzes your existing schedule
- Finds gaps that fit the event duration
- Considers business hours (9 AM - 5 PM by default)
- Avoids conflicts

### 8. **Recurring Events**

**Create repeating events:**
1. Create a new event
2. Enable **"Recurring event"** toggle
3. Choose recurrence pattern:
   - Daily
   - Weekly (select days)
   - Monthly (by date or day of week)
   - Yearly
4. Set end date or number of occurrences

**Edit recurring events:**
- Choose to edit "This event only" or "All events in series"

### 9. **Event Reminders**

**Set reminders:**
1. When creating/editing an event
2. Click **"Add Reminder"**
3. Choose timing:
   - 5, 10, 15, 30 minutes before
   - 1, 2, 24 hours before
   - Custom
4. Choose notification method:
   - In-app notification
   - Email
   - Both

### 10. **Search & Filter**

**Search events:**
- Use the search bar at the top
- Search by title, location, attendee

**Filter by:**
- Calendar source (Microsoft, Google, Local)
- Event type
- Client
- Date range

---

## 🔄 Sync Settings

### Auto-Sync

**Microsoft Calendar:**
- Syncs every 15 minutes automatically
- Manual sync: Click the refresh icon (🔄)

**Google Calendar:**
- Real-time sync via webhooks
- Changes appear within seconds

### Two-Way Sync

Changes sync in both directions:
- Events created in the app appear in Microsoft/Google
- Events created in Microsoft/Google appear in the app
- Edits and deletions sync automatically

### Conflict Resolution

If the same event is edited in multiple places:
- Most recent change wins
- Original version saved in event history
- You'll be notified of conflicts

---

## 📋 Best Practices

### 1. **Use Descriptive Titles**
✅ "Client onboarding call with Smith Corp"
❌ "Call"

### 2. **Add Locations**
- Include Zoom/Teams links for virtual meetings
- Physical address for in-person meetings
- Shows on mobile calendar apps

### 3. **Set Reminders**
- 15 minutes before for internal meetings
- 24 hours before for client meetings
- 1 week before for important deadlines

### 4. **Link to Clients**
- Always link client meetings to the client record
- Creates automatic activity log
- Helps with billing and tracking

### 5. **Use Event Types**
- Categorize events for better organization
- Makes filtering easier
- Improves calendar analytics

---

## 🛠️ Troubleshooting

### Calendar Not Syncing

**Check connection status:**
1. Go to Calendar Settings
2. View "Connected Calendars"
3. Look for error messages

**Re-authenticate:**
1. Click **"Disconnect"** on the problematic calendar
2. Click **"Connect"** again
3. Sign in and authorize

### Events Not Appearing

**Verify:**
- Calendar source is enabled (toggle in settings)
- Date range is correct (not filtered out)
- Event isn't deleted or archived

**Force refresh:**
- Click the refresh icon (🔄)
- Wait 10-15 seconds
- Check if events appear

### Duplicate Events

**Causes:**
- Calendar connected multiple times
- Same account in both Microsoft and Google

**Fix:**
1. Go to Calendar Settings
2. Disconnect duplicate connection
3. Refresh calendar

### Permission Errors

**Microsoft:**
- Revoke access in Microsoft account settings
- Reconnect and re-authorize with all permissions

**Google:**
- Go to Google Account → Security → Third-party apps
- Remove Spencer McGaw Hub
- Reconnect

---

## 📱 Mobile Access

### Web Mobile View
- Responsive design works on mobile browsers
- Swipe to navigate between days/weeks
- Tap to create events

### Native Calendar Apps
- Events sync to your phone's native calendar
- Edit from iPhone/Android calendar app
- Changes sync back automatically

---

## 🔐 Privacy & Security

### Data Storage
- Calendar data stored encrypted in database
- OAuth tokens encrypted with AES-256-GCM
- No plain-text credentials stored

### Access Tokens
- Automatically refreshed before expiration
- Revoked immediately on disconnect
- Never shared with third parties

### Permissions
- Only requested permissions are used
- Can revoke at any time
- Audit log of all calendar access

---

## 💡 Tips & Tricks

### Keyboard Shortcuts
- `N` - New event
- `T` - Today
- `←` / `→` - Previous/Next period
- `/` - Search

### Bulk Operations
- Select multiple events (Ctrl/Cmd + Click)
- Delete, reschedule, or change color in bulk

### Calendar Sharing
- Share your availability with team members
- Create booking links for clients
- Control what others see (busy/free vs details)

### Integration with Other Features
- Events auto-create from task deadlines
- Call history can schedule follow-ups
- Email invites create calendar events

---

## 📞 Support

### Need Help?
- Check the in-app help section (`/help`)
- Contact your administrator
- Email: support@spencermcgaw.com

### Feature Requests
- Submit via `/support` page
- Vote on existing requests
- Track implementation status

---

## 🆕 What's New

### Recent Updates
- ✨ AI-powered scheduling assistant
- 🔗 Enhanced client meeting integration
- 📱 Improved mobile experience
- 🔄 Faster sync performance

### Coming Soon
- 📊 Calendar analytics dashboard
- 🤝 Team calendar views
- 📅 Appointment booking page
- 🔔 Enhanced reminder options

---

**Last Updated:** January 2025
**Version:** 1.0
