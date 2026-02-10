# 📧 IMAP Email Fetcher Setup Guide

**Alternative to Resend inbound webhooks for fetching full email content**

---

## 🎯 When to Use This

Use the IMAP fetcher if:
- ✅ Resend inbound webhooks **don't include email body**
- ✅ You need **full HTML and text content** from emails
- ✅ You want **direct control** over email processing
- ✅ You need to fetch **attachments**

---

## 📋 Prerequisites

1. **Email Account** with IMAP access enabled
   - Gmail, Outlook, or any IMAP-compatible email provider
   - For Gmail: Enable IMAP in Settings → Forwarding and POP/IMAP

2. **App Password** (not your regular password)
   - Gmail: https://myaccount.google.com/apppasswords
   - Outlook/Microsoft 365: https://account.microsoft.com/security

3. **Node.js Dependencies**
   ```bash
   npm install node-imap mailparser @types/node-imap
   ```

---

## ⚙️ Setup Instructions

### Step 1: Install Dependencies

```bash
cd spencer-mcgaw-hub
npm install node-imap mailparser @types/node-imap
```

### Step 2: Add Environment Variables

Add to `.env.local`:

```bash
# IMAP Email Fetcher Configuration
EMAIL_IMAP_HOST=imap.gmail.com        # or imap-mail.outlook.com for Outlook
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=hmcgaw@spencermcgaw.com
EMAIL_IMAP_PASSWORD=your-app-password-here

# Optional: For Vercel Cron authentication
CRON_SECRET=your-random-secret-here
```

**Gmail Settings:**
- Host: `imap.gmail.com`
- Port: `993`
- User: Your Gmail address
- Password: **App Password** (not regular password)

**Outlook Settings:**
- Host: `imap-mail.outlook.com`
- Port: `993`
- User: Your Outlook/Microsoft 365 email
- Password: **App Password**

### Step 3: Test Connection

```bash
# Test IMAP connection
curl -X POST http://localhost:3000/api/email/fetch-imap?test=true

# Expected response:
{
  "success": true,
  "message": "IMAP connection successful"
}
```

### Step 4: Fetch Emails Manually

```bash
# Fetch unread emails (manual trigger)
curl -X POST http://localhost:3000/api/email/fetch-imap

# Expected response:
{
  "success": true,
  "message": "Fetched 5 emails successfully",
  "processed": 5,
  "errors": 0,
  "duration": 2341
}
```

---

## 🤖 Automated Fetching (Vercel Cron)

### Option A: Vercel Cron (Recommended)

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/email/fetch-imap",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This will fetch emails **every 5 minutes** automatically.

**Cron Schedule Examples:**
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours

### Option B: GitHub Actions

Create `.github/workflows/fetch-emails.yml`:

```yaml
name: Fetch Emails

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch Emails
        run: |
          curl -X POST https://your-domain.vercel.app/api/email/fetch-imap \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Option C: External Cron Service (cron-job.org)

1. Go to https://cron-job.org
2. Create free account
3. Add new cron job:
   - URL: `https://your-domain.vercel.app/api/email/fetch-imap`
   - Method: POST
   - Schedule: Every 5 minutes
   - Header: `Authorization: Bearer your-cron-secret`

---

## 🔍 How It Works

### Flow Diagram

```
┌─────────────────────┐
│  Email Inbox (IMAP) │
│  - Unread emails    │
└──────────┬──────────┘
           │
           │ IMAP Connection
           │ (Every 5 minutes)
           ▼
┌─────────────────────────┐
│  IMAP Fetcher           │
│  1. Connect to inbox    │
│  2. Search UNSEEN       │
│  3. Parse each email    │
│  4. Extract full body   │
└──────────┬──────────────┘
           │
           │ Save to DB
           ▼
┌─────────────────────────┐
│  email_messages table   │
│  ✅ body_html           │
│  ✅ body_text           │
│  ✅ attachments         │
└──────────┬──────────────┘
           │
           │ AI Analysis
           ▼
┌─────────────────────────┐
│  potential_tasks table  │
│  - Auto-create tasks    │
└─────────────────────────┘
```

### What Gets Saved

For each email, the fetcher saves:

```typescript
{
  user_id: "uuid" | null,           // User or NULL (unassigned)
  message_id: "unique-id",           // RFC 2822 Message-ID
  subject: "Email Subject",
  from_email: "sender@example.com",
  from_name: "Sender Name",
  body_html: "<p>Full HTML content</p>",  // ✅ FULL CONTENT
  body_text: "Full plain text",           // ✅ FULL CONTENT
  body_preview: "First 500 chars...",
  has_attachments: true,
  attachment_count: 2,
  received_at: "2026-02-10T10:30:00Z",
  is_read: false,
  is_flagged: false  // true for unassigned
}
```

---

## 🧪 Testing

### 1. Test IMAP Connection

```bash
curl -X POST http://localhost:3000/api/email/fetch-imap?test=true
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "IMAP connection successful"
}
```

**Expected Error Response:**
```json
{
  "success": false,
  "message": "IMAP connection failed: Invalid credentials",
  "error": "Invalid credentials"
}
```

### 2. Send Test Email

1. Send an email to `hmcgaw@spencermcgaw.com`
2. Wait 30 seconds
3. Trigger fetch:
   ```bash
   curl -X POST http://localhost:3000/api/email/fetch-imap
   ```
4. Check response:
   ```json
   {
     "success": true,
     "message": "Fetched 1 emails successfully",
     "processed": 1,
     "errors": 0
   }
   ```

### 3. Verify in Database

```sql
-- Check if email was saved with full content
SELECT
  id,
  subject,
  from_email,
  LENGTH(body_html) as html_length,
  LENGTH(body_text) as text_length,
  created_at
FROM email_messages
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Check Frontend

1. Go to `/inbound` page
2. Find the email
3. Expand the card
4. **Message** section should now show full email content ✅

---

## 📊 Comparison: Resend vs IMAP

| Feature | Resend Webhook | IMAP Fetcher |
|---------|---------------|--------------|
| **Email Body** | ❌ Not included | ✅ Full HTML + text |
| **Setup** | Easy (webhook URL) | Medium (credentials) |
| **Real-time** | ✅ Instant | ⚠️ Delayed (5min) |
| **Attachments** | ❌ Limited | ✅ Full support |
| **Cost** | Free (Resend plan) | Free |
| **Reliability** | ✅ High | ✅ High |
| **Control** | ⚠️ Limited | ✅ Full control |
| **Best for** | Quick setup | Full email content |

---

## 🔒 Security Considerations

### 1. Credentials Storage
- ✅ **DO:** Use environment variables (`.env.local`)
- ✅ **DO:** Use App Passwords (not main password)
- ❌ **DON'T:** Commit credentials to Git
- ❌ **DON'T:** Use regular email password

### 2. CRON_SECRET
```bash
# Generate secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local
CRON_SECRET=your-generated-secret-here
```

### 3. Rate Limiting
The IMAP fetcher has built-in limits:
- Max 50 emails per fetch
- Marks as read to avoid re-processing
- Checks for duplicates by `message_id`

---

## 🐛 Troubleshooting

### Error: "Invalid credentials"

**Solution:**
1. Check EMAIL_IMAP_USER is correct
2. Use **App Password**, not regular password
3. For Gmail: Enable "Less secure app access" (if using app password)
4. Check IMAP is enabled in email settings

### Error: "Connection timeout"

**Solution:**
1. Check EMAIL_IMAP_HOST and PORT are correct
2. Gmail: `imap.gmail.com:993`
3. Outlook: `imap-mail.outlook.com:993`
4. Ensure firewall allows outbound port 993

### Error: "ECONNREFUSED"

**Solution:**
1. Check internet connection
2. Verify IMAP server is correct
3. Try testing from command line:
   ```bash
   openssl s_client -connect imap.gmail.com:993
   ```

### Emails Not Appearing

**Check:**
1. ✅ Emails are unread in inbox
2. ✅ IMAP connection successful
3. ✅ Check logs: `npm run dev` and look for `[IMAP Fetcher]`
4. ✅ Verify database: `SELECT * FROM email_messages ORDER BY created_at DESC`

### Performance Issues

**If fetching takes too long:**
1. Reduce limit in `/api/email/fetch-imap/route.ts`:
   ```typescript
   await fetchUnreadEmails(true, 20)  // Default is 50
   ```
2. Increase cron interval (10 min instead of 5 min)
3. Check for very large attachments

---

## 🚀 Deployment Checklist

- [ ] Install dependencies: `npm install node-imap mailparser @types/node-imap`
- [ ] Add environment variables to Vercel
- [ ] Test connection locally
- [ ] Deploy to Vercel
- [ ] Test connection in production
- [ ] Set up Vercel Cron (or alternative)
- [ ] Send test email and verify it appears
- [ ] Monitor logs for first 24 hours

---

## 📝 Maintenance

### Monitoring

Check logs regularly:
```bash
# Vercel CLI
vercel logs --follow

# Look for:
[IMAP Fetcher] Connecting to IMAP server
[IMAP Fetcher] Found unread emails: count=5
[IMAP Fetcher] Email saved successfully
```

### Email Cleanup

Old emails are automatically archived based on your app's retention policy. The IMAP fetcher only processes **unread** emails, so:
- ✅ Emails marked as read are skipped
- ✅ Already processed emails won't be duplicated
- ✅ Set up email filters to auto-archive old emails

---

## 🎯 Next Steps

1. **Choose your approach:**
   - Try Resend Parse feature first (if available)
   - Implement IMAP fetcher as backup/alternative

2. **Test thoroughly:**
   - Send test emails
   - Verify content appears in UI
   - Check AI task creation works

3. **Monitor:**
   - Check logs for errors
   - Verify emails are being fetched
   - Confirm tasks are being created

---

## ✅ Success Checklist

Once setup is complete, you should see:

- ✅ Emails appearing in `/inbound` page
- ✅ **Message** section showing full content when expanded
- ✅ AI-generated tasks in `/taskpool`
- ✅ No errors in logs
- ✅ Attachments displayed (if any)
- ✅ Emails assigned to correct users

---

🍪 **Powered by CodeBakers v6.19**
