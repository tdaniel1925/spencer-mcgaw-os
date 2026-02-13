# Fastmail Email Sync Troubleshooting Guide

## Problem: Emails not syncing from Fastmail

This guide will help you diagnose and fix Fastmail email sync issues.

---

## Quick Diagnostics

### 1. Check Connection Status
```bash
node scripts/check-fastmail-connection.mjs
```

This will show:
- ✅ If Fastmail is connected
- ✅ If connection is active
- ✅ Recent emails in database
- ❌ Common problems

### 2. Test Manual Sync
```bash
node scripts/test-fastmail-sync.mjs
```

This will:
- Trigger immediate email sync
- Show how many emails were processed
- Display any errors

---

## Common Issues & Fixes

### Issue 1: Connection is INACTIVE
**Symptom**: `is_active: false` in connection check

**Fix**: Run this SQL in Supabase:
```sql
UPDATE email_connections
SET is_active = true
WHERE provider = 'imap';
```

---

### Issue 2: No Fastmail Connection
**Symptom**: "No Fastmail/IMAP connections found"

**Fix**:
1. Go to app Settings → Email Integration → Fastmail
2. Enter your Fastmail email address
3. Create app password at: https://www.fastmail.com/settings/security/devicekeys
4. Paste app password and click Connect

---

### Issue 3: Sync Never Runs
**Symptom**: `last_sync_at: null`

**Possible Causes**:
1. **Cron not configured in Vercel**
   - Go to Vercel dashboard
   - Check if cron job is showing up
   - Should run every 5 minutes

2. **Manual sync not working**
   - Go to Settings → Email
   - Click "Sync Now" button
   - Check browser console for errors

---

### Issue 4: No Unread Emails
**Symptom**: Sync runs successfully but no emails appear

**Why**: The sync only fetches UNSEEN (unread) emails

**Fix**:
1. Send a NEW test email to your Fastmail address
2. Do NOT open it in Fastmail (keep it unread)
3. Wait 5 minutes or click "Sync Now"
4. Email should appear in Inbound Communications

---

### Issue 5: Wrong Credentials
**Symptom**: Sync fails with auth error

**Fix**:
1. You MUST use an app-specific password, NOT your regular Fastmail password
2. Go to: https://www.fastmail.com/settings/security/devicekeys
3. Create a new app password
4. Name it "Spencer McGaw Hub" or similar
5. Copy the password
6. Disconnect and reconnect in Settings with the app password

---

## How Email Sync Works

### Automatic Sync (Cron)
- Runs every 5 minutes via Vercel cron
- Calls `/api/cron/sync-emails`
- Syncs ALL connected Fastmail accounts
- Only fetches UNSEEN (unread) emails
- Marks emails as read after fetching

### Manual Sync (Button)
- Go to Settings → Email Integration
- Click "Sync Now" button next to Fastmail account
- Calls `/api/email/fastmail-sync`
- Same logic as automatic sync

### What Gets Synced
1. Connects to Fastmail via IMAP
2. Opens INBOX folder
3. Searches for UNSEEN messages
4. Marks them as read
5. Parses email content
6. Stores in `email_messages` table
7. AI analyzes for potential tasks
8. Creates entries in `potential_tasks` table

---

## Testing Steps

### Step 1: Verify Connection
```bash
node scripts/check-fastmail-connection.mjs
```

Expected output:
```
✅ Found 1 Fastmail connection(s):

📧 john@fastmail.com
   Active: ✅ Yes
   Last Sync: 2026-02-13T15:30:00.000Z
```

### Step 2: Send Test Email
1. From another email address, send email to your Fastmail
2. Subject: "Test Email for Sync"
3. Body: "This is a test to verify email sync is working"
4. **Do NOT open this email in Fastmail** (must stay unread)

### Step 3: Trigger Manual Sync
Go to Settings → Email Integration → Click "Sync Now"

Or run:
```bash
node scripts/test-fastmail-sync.mjs
```

Expected output:
```
✅ Sync Result:
   Success: true
   Users Synced: 1
   Total Emails Processed: 1
```

### Step 4: Check Inbound Communications
Go to app → Inbound Communications

You should see your test email with:
- EMAIL badge
- Your Fastmail address badge
- Subject and preview
- AI summary (if available)

---

## Debugging Vercel Cron

### Check if Cron is Running
1. Go to Vercel dashboard
2. Navigate to your project
3. Click "Cron" tab
4. Should see: `/api/cron/sync-emails` - Every 5 minutes

### View Cron Logs
1. In Vercel dashboard
2. Go to "Logs" tab
3. Filter by `/api/cron/sync-emails`
4. Look for errors or success messages

### Manually Trigger Cron (for testing)
```bash
curl -X POST https://your-app.vercel.app/api/cron/sync-emails
```

---

## Database Checks

### Check email_connections table
```sql
SELECT
  id,
  user_id,
  email,
  provider,
  is_active,
  last_sync_at,
  created_at
FROM email_connections
WHERE provider = 'imap';
```

Should show:
- `is_active = true`
- `last_sync_at` should be recent (within last 5 minutes)

### Check email_messages table
```sql
SELECT
  id,
  subject,
  from_email,
  received_at,
  created_at
FROM email_messages
ORDER BY created_at DESC
LIMIT 10;
```

Should show recent emails after sync.

---

## Still Not Working?

### Check These:

1. **Fastmail IMAP enabled?**
   - Go to Fastmail Settings → Privacy & Security
   - Make sure IMAP is enabled

2. **App password correct?**
   - Try generating a new one
   - Disconnect and reconnect with new password

3. **Firewall blocking?**
   - Vercel might be blocked by Fastmail
   - Check Fastmail security logs

4. **Email in different folder?**
   - Sync only checks INBOX
   - Make sure test email goes to INBOX, not spam/junk

5. **Connection encrypted properly?**
   - Check that `access_token` is encrypted in database
   - Should not be readable plaintext

---

## Success Indicators

✅ Connection shows `is_active: true`
✅ `last_sync_at` updates every 5 minutes
✅ Emails appear in `email_messages` table
✅ Emails visible in Inbound Communications
✅ Task suggestions appear on Dashboard (if relevant)
✅ Manual "Sync Now" button works

---

## Get Help

If you've tried everything above and emails still aren't syncing:

1. Run diagnostic scripts and save output:
   ```bash
   node scripts/check-fastmail-connection.mjs > fastmail-debug.txt
   node scripts/test-fastmail-sync.mjs >> fastmail-debug.txt
   ```

2. Check Vercel logs and copy any errors

3. Provide this information for further troubleshooting
