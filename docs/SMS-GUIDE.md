# 📱 SMS Messaging Guide

## Overview

The Spencer McGaw Hub includes comprehensive two-way SMS messaging powered by Twilio. Send and receive text messages, manage conversations, create campaigns, and automate responses—all from one interface.

---

## 🚀 Getting Started

### Prerequisites

**Admin must configure:**
1. Twilio account with SMS-enabled phone number
2. Environment variables set:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
3. Webhook configured in Twilio console

**Your business phone number:** Shows in the SMS interface header

---

## ✨ Features

### 1. **Two-Way Messaging**

**Access SMS:**
- Navigate to `/sms` from the main navigation
- View all active conversations

**Send a message:**
1. Select a conversation from the list (left panel)
2. Type your message in the text box
3. Click **Send** or press `Enter`
4. Message appears in the conversation thread

**Receive messages:**
- Incoming messages appear automatically
- Real-time updates (no refresh needed)
- Desktop notifications (if enabled)
- Unread count badge on conversation

**Message status indicators:**
- ✓ Sent
- ✓✓ Delivered
- ⚠️ Failed (with error details)

### 2. **Conversations Management**

**View conversations:**
- **All** - Every conversation
- **Unread** - Messages you haven't read
- **Priority** - Marked as priority
- **Archived** - Completed conversations

**Filter conversations:**
- Search by name, phone number, or message content
- Filter by client
- Sort by most recent, unread count, priority

**Conversation actions:**
- 🌟 **Star** - Mark as priority
- 📦 **Archive** - Move to archived
- 🔇 **Mute** - No notifications
- 👤 **Assign** - Assign to team member
- 🔗 **Link Client** - Associate with client record

### 3. **Message Templates**

**Create templates:**
1. Go to SMS → **Templates** tab
2. Click **+ New Template**
3. Add template details:
   - Name (for your reference)
   - Category (greeting, follow-up, etc.)
   - Message text
4. Use variables: `{{firstName}}`, `{{company}}`, `{{deadline}}`
5. Save template

**Use templates:**
1. In any conversation, click the **Templates** icon
2. Select a template
3. Variables auto-fill from client data
4. Review and edit if needed
5. Send

**Example templates:**
```
Welcome Message:
"Hi {{firstName}}! Thanks for reaching out to Spencer McGaw CPA.
How can we help you today?"

Appointment Reminder:
"Hi {{firstName}}, this is a reminder about your appointment
tomorrow at {{time}}. Reply CONFIRM if you can make it."

Document Request:
"Hi {{firstName}}, we still need your {{documentType}} for your
{{taxYear}} tax return. Can you send that over?"
```

### 4. **Auto-Responders**

**After-Hours Response:**
1. Go to `/admin/sms-settings`
2. Enable **After-Hours Auto-Reply**
3. Set business hours (e.g., 9 AM - 5 PM, Mon-Fri)
4. Customize message:
   ```
   Thanks for your message! Our office is currently closed.
   We'll respond when we're back in the office.
   Business hours: Mon-Fri 9 AM - 5 PM
   ```

**Keyword-Based Responses:**
1. Go to SMS → **Auto-Responders** tab
2. Click **+ New Auto-Responder**
3. Configure:
   - **Trigger keywords:** ["hours", "schedule", "when"]
   - **Response:** "Our office hours are Mon-Fri 9 AM - 5 PM..."
   - **Priority:** Higher priority runs first
4. Save

**How it works:**
- Incoming message checked for keywords
- First matching responder triggers
- Response sent automatically
- Logged in conversation history

### 5. **Opt-In / Opt-Out Management**

**Compliance (Required by Law):**
- All SMS must allow opt-out
- Automatic handling built-in

**Opt-Out Keywords (Default):**
- STOP
- UNSUBSCRIBE
- CANCEL
- END
- QUIT

**When someone opts out:**
1. Automatically marked as opted-out
2. Confirmation sent: "You've been unsubscribed..."
3. Can no longer send them messages
4. Logged in opt-out log

**Opt-In Keywords (Default):**
- START
- YES
- UNSTOP

**When someone opts in:**
1. Re-subscribes to messages
2. Confirmation sent
3. Conversation status updated

**View opt-out log:**
- Go to `/admin/sms-settings`
- Click **Opt-Out Log** tab
- Export for compliance reporting

### 6. **SMS Campaigns**

**Create a campaign:**
1. Go to `/sms/campaigns`
2. Click **+ New Campaign**
3. Configure campaign:
   - **Name:** "Tax Season Reminder 2025"
   - **Message:** Compose your message (max 160 chars for 1 segment)
   - **Recipients:** Select from:
     - All active clients
     - Specific client list
     - Contact group
     - Manual phone numbers
   - **Schedule:** Send now or schedule for later
4. Review recipients (only opted-in contacts)
5. Click **Create Campaign**

**Campaign status:**
- **Draft** - Not sent yet
- **Scheduled** - Queued for sending
- **Sending** - In progress
- **Completed** - All messages sent
- **Cancelled** - Stopped before completion

**Campaign analytics:**
- Total sent
- Delivered count
- Failed count
- Response rate
- Opt-out rate

**Best practices:**
- Keep messages under 160 characters (1 SMS segment)
- Include opt-out instructions
- Send during business hours
- Test with yourself first
- Track responses

### 7. **Message Analytics**

**View analytics:**
- Go to `/sms/analytics`
- See metrics for:
  - Messages sent/received
  - Delivery rates
  - Response times
  - Active conversations
  - Opt-out rates

**Date range filters:**
- Last 7 days
- Last 30 days
- This month
- Custom range

**Export data:**
- CSV export for all metrics
- Useful for reporting and compliance

### 8. **MMS (Media Messages)**

**Send images/files:**
1. In any conversation
2. Click the **📎 Attach** icon
3. Select image or file (max 5MB)
4. Supported formats:
   - Images: JPG, PNG, GIF
   - Documents: PDF
   - Video: MP4 (up to 1MB)
5. Add caption (optional)
6. Send

**Receive media:**
- Media appears inline in conversation
- Click to view full size
- Download to save

**Note:** MMS costs more than SMS (check your Twilio pricing)

### 9. **Client Integration**

**Link conversations to clients:**
1. Open a conversation
2. Click **Link Client** icon
3. Search and select client
4. Conversation now shows in client record

**Benefits:**
- SMS history appears in client timeline
- Access from both SMS and Clients pages
- Automatic contact matching
- Better context for conversations

**Auto-matching:**
- System auto-matches phone numbers to existing clients
- Uses both primary and alternate phone fields
- Matched conversations auto-link

### 10. **Team Collaboration**

**Assign conversations:**
1. Open conversation
2. Click **Assign** dropdown
3. Select team member
4. They receive notification

**Internal notes:**
1. Click **Add Note** in conversation
2. Write internal note (not sent to client)
3. Visible to team only
4. Use for handoff context

**Conversation status:**
- **Open** - Active conversation
- **Pending** - Waiting for client response
- **Resolved** - Conversation complete
- **Archived** - No longer active

---

## 📋 Best Practices

### 1. **Response Time**
- Aim to respond within 1 hour during business hours
- Use after-hours auto-responder
- Set expectations in first message

### 2. **Message Length**
- Keep under 160 characters when possible (1 SMS segment)
- Longer messages split and cost more
- Use templates for common responses

### 3. **Professional Tone**
```
✅ Good:
"Hi Sarah, this is Mike from Spencer McGaw CPA.
I have a question about your tax return.
Can you call me when you have a moment?"

❌ Avoid:
"hey got a question call me"
```

### 4. **Compliance**
- ✅ Get consent before texting
- ✅ Include business name in first message
- ✅ Honor opt-outs immediately
- ✅ Keep records of opt-ins/opt-outs
- ❌ Don't text outside business hours (unless urgent)
- ❌ Don't spam clients with messages

### 5. **Security**
- ❌ Don't send SSNs or sensitive data via SMS
- ❌ Don't request passwords or account numbers
- ✅ Use email for sensitive documents
- ✅ Direct clients to secure portal for uploads

---

## 🛠️ Troubleshooting

### Messages Not Sending

**Check:**
1. Phone number is in valid format: +12345678900
2. Recipient hasn't opted out
3. Your Twilio account has credits
4. No error message in conversation

**Fix:**
- Click **Retry** on failed message
- Verify phone number
- Contact admin if persists

### Not Receiving Messages

**Verify webhook:**
1. Admin checks Twilio console
2. Webhook URL should be: `https://your-domain.com/api/sms/webhook`
3. HTTP POST method
4. Signature validation enabled

**Test webhook:**
- Send a test message from your phone
- Check webhook logs in admin panel
- Look for errors

### Messages Coming from Unknown Numbers

**When this happens:**
- Message appears but no conversation exists
- Logged as "unknown sender"
- Admin notified

**To fix:**
1. Create contact for phone number
2. System will auto-create conversation
3. Future messages will be threaded

### Delivery Failures

**Common reasons:**
- Invalid phone number
- Number is landline (SMS not supported)
- Carrier blocking
- Phone powered off

**Error codes:**
- 30003: Unreachable destination
- 30004: Message blocked
- 30005: Unknown destination
- 30006: Landline or unreachable carrier

---

## 🔐 Privacy & Security

### Data Protection
- All messages encrypted in database
- Secure transmission via Twilio
- Access controlled by user permissions

### Compliance
- TCPA compliant (US)
- CASL compliant (Canada)
- GDPR compliant (EU)
- Automatic opt-out handling
- Audit logs for all messages

### Message Retention
- Messages kept for 7 years (default)
- Configurable retention policy
- Export before deletion
- Secure deletion process

---

## 📱 Mobile Access

### Web Mobile
- Full SMS features on mobile browser
- Responsive design
- Swipe gestures
- Push notifications

### Desktop Notifications
**Enable notifications:**
1. Click notification icon in SMS interface
2. Browser will ask for permission
3. Allow notifications
4. Configure preferences (sound, desktop, etc.)

---

## 💡 Tips & Tricks

### Keyboard Shortcuts
- `Enter` - Send message
- `Shift + Enter` - New line
- `/` - Search conversations
- `Esc` - Close conversation

### Bulk Actions
- Select multiple conversations (checkbox)
- Archive all
- Assign all
- Mark as read

### Quick Replies
- Create templates for common questions
- Use canned responses
- Save time with keyboard shortcuts

### Search Power
**Advanced search:**
- `from:+12345678900` - Messages from number
- `client:"John Smith"` - By client name
- `after:2025-01-01` - Date range
- `keyword` - Message content

---

## 📊 Analytics & Reporting

### Key Metrics

**Volume:**
- Messages sent/received per day
- Peak messaging times
- Average response time

**Engagement:**
- Active conversations
- Response rate
- Conversation length

**Compliance:**
- Opt-in rate
- Opt-out rate
- Bounce rate

### Reports

**Generate reports:**
1. Go to `/sms/analytics`
2. Select date range
3. Choose metrics
4. Export as CSV or PDF

**Scheduled reports:**
- Weekly SMS summary (email)
- Monthly compliance report
- Quarterly usage stats

---

## 🆕 What's New

### Recent Updates
- ✨ Enhanced auto-responders
- 📊 New analytics dashboard
- 🎨 Improved conversation UI
- ⚡ Faster message delivery

### Coming Soon
- 🤖 AI-powered response suggestions
- 📅 Scheduled messages
- 📞 Click-to-call integration
- 🔗 Email-to-SMS forwarding

---

## 📞 Support

### Need Help?
- In-app help: `/help`
- Contact admin
- Email: support@spencermcgaw.com

### Twilio Issues
- Check Twilio status: status.twilio.com
- Review account limits
- Verify phone number ownership

---

## 📝 Message Limits & Costs

### Sending Limits
- **Domestic (US/Canada):**
  - 1 segment = 160 characters
  - Long messages split into multiple segments

- **International:**
  - Varies by country
  - Higher costs apply

### Character Encoding
- **Standard (GSM-7):** 160 chars/segment
  - Letters, numbers, basic punctuation

- **Unicode (UCS-2):** 70 chars/segment
  - Emojis, special characters
  - Reduces character limit

**Tip:** Stick to standard characters to maximize message length

### Cost Management
- Monitor usage in analytics
- Set budget alerts in Twilio
- Use templates to reduce drafting time
- Avoid unnecessary MMS

---

## ✅ Compliance Checklist

Before sending SMS campaigns:
- [ ] All recipients gave explicit consent
- [ ] Business name included in message
- [ ] Opt-out instructions provided
- [ ] Messages sent during business hours
- [ ] Opt-out log maintained
- [ ] No sensitive data in messages
- [ ] Message content is truthful and clear

---

**Last Updated:** January 2025
**Version:** 1.0
