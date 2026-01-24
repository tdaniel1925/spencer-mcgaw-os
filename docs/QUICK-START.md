# 🚀 Quick Start Guide - Email, Calendar & SMS

## Welcome to Spencer McGaw Hub!

This guide will help you set up and start using the core communication features.

---

## 📧 Email Integration (5 minutes)

### Step 1: Connect Your Email
1. Go to `/my-inbox`
2. Click **"Connect Email Account"**
3. Choose **Microsoft 365 / Outlook**
4. Sign in and authorize permissions
5. Wait for initial sync (usually 1-2 minutes)

### Step 2: Start Using Email
- View emails in `/my-inbox`
- AI automatically classifies and sorts messages
- Create tasks from emails
- Link emails to clients

**See full guide:** [Email Guide](./EMAIL-GUIDE.md)

---

## 📅 Calendar Integration (3 minutes)

### Step 1: Access Calendar
1. Navigate to `/calendar`
2. Calendar is ready to use immediately

### Step 2: Connect External Calendars (Optional)
1. Click Settings ⚙️ in calendar
2. Choose **Microsoft** or **Google**
3. Authorize and sync

### Step 3: Create Your First Event
1. Click **+ New Event**
2. Fill in details (title, time, location)
3. Link to a client (optional)
4. Save

**See full guide:** [Calendar Guide](./CALENDAR-GUIDE.md)

---

## 📱 SMS Messaging (Admin Setup Required)

### Admin Setup (One-time)
1. Create Twilio account
2. Buy phone number
3. Add credentials to environment:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
4. Configure webhook in Twilio:
   - URL: `https://your-domain.com/api/sms/webhook`
   - Method: POST
   - Enable signature validation

### User Setup
1. Go to `/sms`
2. View existing conversations
3. Click a conversation to send messages
4. Messages sync in real-time

### Send Your First Message
1. Select a conversation
2. Type message
3. Press Enter or click Send
4. See delivery status (✓✓ = delivered)

**See full guide:** [SMS Guide](./SMS-GUIDE.md)

---

## 📞 Phone Call Tracking (Auto)

### GoTo Connect Integration
- Calls automatically appear in `/calls`
- AI analyzes transcripts
- Suggests tasks from calls
- Links to client records

**No setup required if GoTo is configured by admin**

---

## 🎯 Next Steps

### Set Up Your Profile
1. Go to `/settings`
2. Update notification preferences
3. Set your timezone
4. Configure email signature

### Explore Features
- ✅ Task management (`/taskpool`)
- ✅ Client records (`/clients`)
- ✅ Document management (`/files`)
- ✅ Team chat (`/chat`)

### Get Help
- In-app help: `/help`
- Support: `/support`
- Documentation: `/docs`

---

## 🔥 Pro Tips

### Time-Savers
1. **Use templates** - Create message templates for common responses
2. **Keyboard shortcuts** - `N` for new event, `/` for search
3. **AI scheduling** - Let AI find meeting times
4. **Auto-responders** - Set up after-hours SMS replies

### Integration Power
1. **Tasks from emails** - Turn emails into actionable tasks
2. **Calendar from tasks** - Task deadlines show on calendar
3. **Client linking** - Link calls, emails, SMS to client records
4. **Unified timeline** - See all client interactions in one place

### Stay Organized
1. **Star priority items** - Email, SMS, and calendar events
2. **Use filters** - Quick access to unread, priority, etc.
3. **Archive completed** - Keep inbox and conversations clean
4. **Search everything** - Unified search across all features

---

## ❓ Common Questions

**Q: Do I need to connect all calendar sources?**
A: No, you can use the built-in local calendar without connecting external calendars.

**Q: Can clients reply to my emails?**
A: Yes, your emails come from your connected Microsoft account. Replies go to your inbox.

**Q: How much does SMS cost?**
A: Pricing depends on your Twilio plan. Domestic SMS is typically $0.0075 per message.

**Q: Are messages encrypted?**
A: Yes, all data is encrypted at rest and in transit.

**Q: Can I use my existing phone number for SMS?**
A: Only if it's a Twilio number. Personal numbers can't send SMS via the app.

**Q: What if I disconnect my email?**
A: Existing emails remain in the system. New emails won't sync. You can reconnect anytime.

---

## 🆘 Troubleshooting

### Email not syncing
- Check connection status in settings
- Re-authenticate if needed
- Wait 15 minutes for initial sync

### Calendar events missing
- Verify calendar source is enabled
- Check date range filters
- Click refresh icon

### SMS not working
- Verify Twilio credentials with admin
- Check webhook configuration
- Test with your own phone first

---

## 📚 Full Documentation

- [Calendar Guide](./CALENDAR-GUIDE.md) - Complete calendar features
- [SMS Guide](./SMS-GUIDE.md) - Two-way messaging & campaigns
- [Email Guide](./EMAIL-GUIDE.md) - Email integration & AI features
- [Files Guide](./FILES-GUIDE.md) - Document management
- [API Documentation](./API.md) - Developer reference

---

**Need more help?** Contact support at support@spencermcgaw.com

**Version:** 1.0 | **Last Updated:** January 2025
