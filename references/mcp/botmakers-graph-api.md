# BotMakers MCP - Microsoft Graph API Integration

## Overview
This document outlines the integration with Microsoft Graph API via BotMakers MCP for email processing and management within the Spencer McGaw Hub.

## Capabilities

### Email Operations (Microsoft Graph API)
- **Read emails** - Fetch inbox, sent items, folders
- **Send emails** - Compose and send with attachments
- **Search emails** - Full-text search across mailboxes
- **Manage folders** - Create, move, delete folders
- **Handle attachments** - Download, upload, process attachments
- **Webhooks/Subscriptions** - Real-time notifications for new emails

### Calendar Operations
- **List events** - Fetch calendar events with date range filtering
- **Create events** - Schedule meetings with attendees
- **Update events** - Modify existing calendar entries
- **Delete events** - Remove calendar entries
- **Calendar view** - Query events across date ranges

### Contacts Operations
- **List contacts** - Fetch all Microsoft contacts
- **Search contacts** - Filter by name, email, company
- **Create contacts** - Add new contacts to Microsoft
- **Sync to clients** - Import Microsoft contacts into clients table
- **Match emails** - Auto-link incoming emails to existing contacts/clients

### Required Graph API Permissions
```
# Email
Mail.Read
Mail.ReadWrite
Mail.Send

# Calendar
Calendars.Read
Calendars.ReadWrite

# Contacts
Contacts.Read
Contacts.ReadWrite

# User
User.Read

# Optional
Files.ReadWrite (for OneDrive attachment storage)
```

## Authentication Flow

### OAuth 2.0 with Microsoft Identity Platform
1. User clicks "Connect Email Account"
2. Redirect to Microsoft login
3. User grants permissions
4. Receive authorization code
5. Exchange for access/refresh tokens
6. Store tokens securely in Supabase

### Token Storage Schema
```sql
-- users_email_connections table
id: uuid
user_id: uuid (FK to users)
provider: 'microsoft' | 'google'
email: string
access_token: encrypted
refresh_token: encrypted
expires_at: timestamp
scopes: string[]
created_at: timestamp
updated_at: timestamp
```

## Email Processing Pipeline

### Incoming Email Flow
```
1. Webhook notification (new email)
   ↓
2. Fetch full email details
   ↓
3. AI Classification
   - Client identification (match sender to client)
   - Intent detection (document, question, request)
   - Priority assessment
   ↓
4. Automated Actions
   - Extract attachments → Documents page
   - Create tasks for follow-up
   - Route to assigned team member
   - Auto-respond if configured
   ↓
5. Log activity
```

### Attachment Processing Rules
```typescript
interface AttachmentRule {
  fileTypes: string[];        // ['.pdf', '.xlsx', '.doc']
  action: 'extract' | 'ignore' | 'flag';
  destination: 'documents' | 'specific_folder';
  notifyUser?: string;        // user_id to notify
  createTask?: boolean;
  taskTemplate?: string;
}
```

### Email Classification Categories
- `document_submission` - Client sending tax docs, statements
- `question` - Client asking about status, services
- `appointment_request` - Scheduling inquiry
- `urgent` - Time-sensitive matter
- `spam` - Unrelated/marketing
- `internal` - From team members

## API Endpoints to Implement

### `/api/email/connect`
POST - Initiate OAuth flow for email connection

### `/api/email/callback`
GET - Handle OAuth callback, store tokens

### `/api/email/inbox`
GET - Fetch user's inbox with pagination

### `/api/email/[id]`
GET - Fetch single email details
DELETE - Delete/archive email

### `/api/email/send`
POST - Send new email or reply

### `/api/email/webhook`
POST - Receive Graph API notifications

### `/api/email/process`
POST - Manually trigger processing on an email

### `/api/calendar/events`
GET - Fetch calendar events with date range
POST - Create new calendar event

### `/api/contacts`
GET - Fetch Microsoft contacts
POST - Create new contact in Microsoft

### `/api/contacts/sync`
POST - Sync Microsoft contacts to clients table

## Environment Variables Required
```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=
```

## UI Components Needed

### Email Inbox Page (`/email`)
- Folder sidebar (Inbox, Sent, Drafts, etc.)
- Email list with search/filter
- Email preview pane
- Compose modal

### Email Settings (`/settings` integration)
- Connect/disconnect email accounts
- Processing rules configuration
- Auto-response templates
- Notification preferences

### Email Processing Dashboard
- Processing queue status
- Recent auto-actions taken
- Failed processing alerts
- Rule performance metrics

## Integration Points

### With Clients
- Auto-match sender email to client record
- Show email history on client profile
- Quick email from client page

### With Tasks
- Create tasks from emails
- Link tasks to source emails
- Email notifications on task updates

### With Documents
- Auto-extract attachments to document library
- Tag documents with source email
- Link documents to clients

### With Activity Log
- Log all email activities
- Track processing actions
- Audit trail for compliance
