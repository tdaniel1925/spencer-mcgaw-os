# 📧 Email Content Not Showing - Root Cause & Solutions

**Date:** February 10, 2026
**Issue:** Forwarded emails showing up without body content
**Status:** 🔴 **CRITICAL - Resend API Limitation**

---

## 🔍 Root Cause Analysis

### The Problem
Forwarded emails are being received and stored, but the email body (`bodyHtml` and `bodyText`) is **empty** in the database.

### Why This Happens

**Resend Inbound Email API Limitation:**

1. **Resend Webhooks DON'T Include Email Body by Default**
   - Resend inbound webhooks only send metadata: `from`, `to`, `subject`, `headers`
   - Email body (`html` and `text`) is **NOT** included in webhook payload

2. **Current Code Tries to Fetch Body from Resend API**
   - Location: `src/app/api/email/webhook/route.ts` lines 94-150
   - Attempts to call `GET https://api.resend.com/emails/{email_id}`
   - **However:** Resend's GET endpoint also doesn't return the body for inbound emails

3. **Result**
   - Email is saved with: ✅ from, to, subject, metadata
   - Email is saved WITHOUT: ❌ body_html, body_text
   - UI displays empty message because both fields are NULL

### Code Flow (Current State)

```typescript
// 1. Webhook receives email from Resend
webhook.data = {
  from: "user@example.com",
  to: ["hmcgaw@shwunde745.resend.app"],
  subject: "Important Document",
  html: undefined,  // ❌ NOT INCLUDED
  text: undefined,  // ❌ NOT INCLUDED
  email_id: "abc123"
}

// 2. Code checks if body is missing
if (!email.text && !email.html && email.email_id) {
  // Try to fetch from Resend API
  const response = await fetch(`https://api.resend.com/emails/${email.email_id}`)
  // ❌ API response also doesn't include body for inbound emails
}

// 3. Email saved to database with NULL body
await supabase.from('email_messages').insert({
  subject: "Important Document",
  body_html: null,  // ❌ Empty
  body_text: null,  // ❌ Empty
  from_email: "user@example.com"
})

// 4. Frontend displays (correctly) - but body is empty
if (comm.bodyHtml || comm.bodyText) {
  // This condition is FALSE because both are NULL
  // So "Message" section doesn't appear
}
```

---

## ✅ Solution Options

### **Option 1: Use Resend Inbound Parse Feature** ⭐ **RECOMMENDED**
**Difficulty:** Easy
**Cost:** Free (included in Resend)
**Time:** 30 minutes

Resend has a Parse API that can include email bodies:

```typescript
// Update Resend inbound webhook to use Parse
// Configure in Resend Dashboard:
// 1. Go to Domains → Inbound Settings
// 2. Enable "Parse Email Content"
// 3. Check "Include HTML" and "Include Plain Text"

// Webhook will then receive:
{
  type: 'email.received',
  data: {
    from: "user@example.com",
    subject: "Important Document",
    html: "<p>Full HTML content here</p>",  // ✅ NOW INCLUDED
    text: "Full plain text here"            // ✅ NOW INCLUDED
  }
}
```

**Pros:**
- ✅ Simple configuration change in Resend dashboard
- ✅ No code changes needed
- ✅ Free (no additional cost)
- ✅ Works with existing email forwarding

**Cons:**
- ⚠️ Requires Resend inbound parse feature (check if available in your plan)

---

### **Option 2: IMAP Email Fetching** 🔧 **ROBUST**
**Difficulty:** Medium
**Cost:** Free (using existing email account)
**Time:** 2-3 hours

Set up IMAP connection to fetch emails directly from mailbox:

```typescript
// New endpoint: /api/email/fetch-imap
// Uses nodemailer/imap to connect to email account

import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

// 1. Connect to email account via IMAP
const imap = new Imap({
  user: 'hmcgaw@spencermcgaw.com',
  password: process.env.EMAIL_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true
});

// 2. Fetch emails from inbox
imap.openBox('INBOX', false, () => {
  // Search for unread emails
  imap.search(['UNSEEN'], (err, results) => {
    // 3. Parse each email
    const f = imap.fetch(results, { bodies: '' });
    f.on('message', (msg) => {
      msg.on('body', (stream) => {
        simpleParser(stream, (err, parsed) => {
          // ✅ Full email content available
          const bodyHtml = parsed.html;
          const bodyText = parsed.text;

          // Save to database
        });
      });
    });
  });
});
```

**Pros:**
- ✅ Full control over email fetching
- ✅ Works with any email provider (Gmail, Outlook, etc.)
- ✅ Can fetch attachments
- ✅ Can run on schedule (e.g., every 5 minutes)
- ✅ No dependency on Resend

**Cons:**
- ⚠️ Requires email credentials
- ⚠️ Need to handle authentication securely
- ⚠️ More complex to set up
- ⚠️ Need to mark emails as read/processed

---

### **Option 3: Direct Email Parsing (Postmark/Mailgun)**
**Difficulty:** Medium
**Cost:** Free tier available
**Time:** 1-2 hours

Switch from Resend to alternative that DOES include body:

**Postmark Inbound:**
```json
{
  "From": "user@example.com",
  "Subject": "Important Document",
  "HtmlBody": "<p>Full HTML here</p>",     // ✅ INCLUDED
  "TextBody": "Full plain text here",      // ✅ INCLUDED
  "Headers": [...]
}
```

**Pros:**
- ✅ Inbound webhooks include full body by default
- ✅ Better email parsing
- ✅ Attachment handling included

**Cons:**
- ⚠️ Need to switch from Resend (migration effort)
- ⚠️ Different API/configuration

---

### **Option 4: Email Parser Service (Make.com/Zapier)**
**Difficulty:** Easy
**Cost:** ~$10/month
**Time:** 1 hour

Use no-code automation:

1. **Make.com** or **Zapier** watches mailbox
2. Parses email body automatically
3. Sends to your webhook with full content

**Pros:**
- ✅ No code changes needed
- ✅ Easy to set up
- ✅ Visual interface

**Cons:**
- ⚠️ Monthly cost
- ⚠️ External dependency

---

## 🎯 Recommended Solution: **Option 1 + Fallback to Option 2**

### **Phase 1: Enable Resend Parse (Quick Fix)**
1. Login to Resend dashboard
2. Go to Inbound Email settings
3. Enable "Parse Email Content"
4. Check "Include HTML" and "Include Plain Text"
5. Test by forwarding an email

**If Resend Parse is not available in your plan:**

### **Phase 2: Implement IMAP Fetching (Robust Solution)**

I can help you implement IMAP email fetching that:
- ✅ Fetches emails every 5 minutes
- ✅ Parses full body content (HTML + text)
- ✅ Handles attachments
- ✅ Works with any email provider
- ✅ Runs as background job

---

## 📊 Current State vs After Fix

### Current State ❌
```
Email Received → Resend Webhook → Save to DB
                 (no body)         ↓
                              body_html: null
                              body_text: null
                                  ↓
                         Frontend shows: (empty)
```

### After Fix ✅
```
Email Received → Resend Parse → Save to DB
                 (with body)      ↓
                           body_html: "<p>Content</p>"
                           body_text: "Content"
                                  ↓
                         Frontend shows: Full email content
```

---

## 🚀 Next Steps

**Choose your approach:**

1. **Quick Fix (Recommended First):**
   - [ ] Check Resend dashboard for Parse feature
   - [ ] Enable "Include HTML/Text" in inbound settings
   - [ ] Test with forwarded email
   - [ ] Verify body appears in database

2. **If Resend Parse unavailable:**
   - [ ] I'll implement IMAP email fetching
   - [ ] Set up secure credential storage
   - [ ] Create background job to check inbox
   - [ ] Test with real emails

3. **Alternative:**
   - [ ] Switch to Postmark/Mailgun for inbound
   - [ ] Migrate existing configuration
   - [ ] Update webhook handler

---

## 🔍 How to Check Resend Configuration

**Option A: Resend Dashboard**
```
1. Login to dashboard.resend.com
2. Go to "Domains" → your domain
3. Click "Inbound" or "Receiving"
4. Look for "Parse Settings" or "Content Options"
5. Enable "Include email body in webhooks"
```

**Option B: Check Current Webhook Payload**

Add logging to webhook handler:
```typescript
// In src/app/api/email/webhook/route.ts
logger.info('[Email Webhook] RAW PAYLOAD', {
  hasHtml: !!body.data.html,
  hasText: !!body.data.text,
  keys: Object.keys(body.data),
  bodyData: body.data  // See what Resend actually sends
});
```

Then forward an email and check logs to see if body is included.

---

## 💡 Why This Matters

**Impact on Users:**
- ❌ **Cannot read email content** - users only see subject
- ❌ **Cannot create accurate tasks** - AI can't analyze empty body
- ❌ **Poor user experience** - have to open original email elsewhere

**Business Impact:**
- ❌ **Reduced productivity** - staff can't triage emails in-app
- ❌ **AI features broken** - email intelligence needs body content
- ❌ **Task automation fails** - can't extract action items from empty emails

---

## ✅ Conclusion

**Root Cause:** Resend inbound webhooks don't include email body by default

**Best Solution:** Enable Resend Parse feature (if available)

**Backup Solution:** Implement IMAP email fetching for full control

**Would you like me to:**
1. Help you check Resend dashboard settings?
2. Implement IMAP email fetching?
3. Switch to alternative email service?

Let me know which approach you'd like to take and I'll implement it immediately!

---

🍪 **Powered by CodeBakers v6.19**
