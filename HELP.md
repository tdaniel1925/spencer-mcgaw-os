# Spencer McGaw Hub - Help & Documentation

## Overview

Spencer McGaw Hub is a comprehensive client management platform for accounting/tax firms. It provides AI-powered email management, client tracking, task management, and phone call integration.

---

## Email System

### Connecting Email Accounts

1. Go to **Admin > System Settings**
2. Click "Connect Email Account"
3. Authenticate with Microsoft 365/Outlook
4. Your emails will automatically sync

### AI Email Classification

The system automatically classifies incoming emails into:
- **Business-relevant** (shown in Inbox)
- **Filtered** (spam, marketing, newsletters)

Classification is based on:
- Sender patterns (known spam domains)
- Content analysis (promotional language, unsubscribe links)
- Subject line analysis
- AI-detected categories (document request, payment, appointment, etc.)

### Training the Classifier

The email system learns from your corrections. When you mark an email as relevant or filtered, it:
1. Saves the feedback to a shared training database
2. Learns from sender patterns (domains and email addresses)
3. Applies learned patterns to future emails

**All users share the same training data** - corrections by one user improve classification for everyone.

### Train Filter from Sent Emails (Admin)

Admins can automatically whitelist domains based on sent email history:

1. Click the **"Train Filter"** button (sparkles icon) in the email page header
2. The system scans your sent emails (up to 500)
3. Extracts all recipient email domains
4. Automatically whitelists business domains (excludes gmail.com, yahoo.com, etc.)
5. Shows results: how many domains were whitelisted

**Why this helps**: If you've sent emails to a domain, those contacts are likely legitimate business contacts. Auto-whitelisting ensures their replies won't be filtered as spam.

### Email Actions

#### Single Email Actions
- **View Email**: Click any email card to see full details
- **Create Task**: Converts email into a tracked task on the Kanban board
- **Mark as Filtered**: Moves relevant email to filtered (thumbs down button)
- **Mark as Relevant**: Moves filtered email back to inbox (thumbs up button)

#### Bulk Email Actions
1. **Select emails** using checkboxes on each card
2. **Select All**: Click the checkbox icon in the header
3. **Bulk actions appear** showing selected count:
   - In Inbox: "Filter Out" button moves all to filtered
   - In Filtered: "Mark Relevant" button moves all to inbox
4. **Clear selection**: Click "Clear" button

#### Sender Rules (Whitelist/Blacklist)
When viewing an email, click "Sender Rules" to:
- **Always allow @domain.com**: Future emails always go to inbox
- **Always filter @domain.com**: Future emails always filtered

### Email Task Board (Kanban)

Tasks created from emails appear on the Kanban board with columns:
- **New**: Unprocessed email tasks
- **Waiting on Client**: Awaiting response
- **In Progress**: Currently being worked on
- **Completed**: Finished tasks

**Drag and drop** cards between columns to update status.

### Customizing Kanban Columns (Admin)

Admins can fully customize the Kanban board columns:

1. Click the **Settings icon** (gear) in the Task Board header
2. In the column settings modal, you can:
   - **Add columns**: Click "Add Column" to create new columns
   - **Remove columns**: Click the X button (minimum 1 column required)
   - **Rename columns**: Edit the column name directly
   - **Change colors**: Click the color swatch to pick from 10 colors
   - **Reorder columns**: Use the up/down arrows to change order
   - **Reset to defaults**: Click "Reset to Defaults" to restore original columns
3. Click **Save Changes** to apply

**Note**: When a column is deleted, any tasks in that column automatically move to the first column.

#### Default Columns
| Column | Color | Purpose |
|--------|-------|---------|
| New | Blue | Newly created tasks |
| Waiting on Client | Amber | Awaiting client response |
| In Progress | Purple | Currently being worked |
| Completed | Green | Finished tasks |

#### Available Colors
Blue, Purple, Green, Amber, Red, Pink, Cyan, Orange, Slate, Emerald

---

## Code Examples

### Adding a New Email Classification Category

Edit `src/lib/email/types.ts`:

```typescript
// Add to EmailTaskCategory type
export type EmailTaskCategory =
  | "document_request"
  | "question"
  | "payment"
  | "your_new_category"  // Add here
  | "other";

// Add display info
export const emailCategoryInfo: Record<EmailTaskCategory, { label: string; color: string; icon: string }> = {
  // ... existing categories
  your_new_category: {
    label: "Your Category",
    color: "bg-cyan-100 text-cyan-700",
    icon: "YourIcon"
  },
};
```

### Creating a New Sender Rule via API

```typescript
// POST /api/email/sender-rules
const response = await fetch('/api/email/sender-rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ruleType: 'domain',           // 'email' or 'domain'
    matchType: 'exact',           // 'exact', 'contains', or 'ends_with'
    matchValue: 'spam-domain.com',
    action: 'blacklist',          // 'whitelist' or 'blacklist'
    reason: 'Known spam source'
  })
});
```

### Using the Email Context in Components

```typescript
import { useEmail } from '@/lib/email';

function MyComponent() {
  const {
    emails,              // Business-relevant emails
    rejectedEmails,      // Filtered emails
    markAsRelevant,      // Move to inbox
    markAsRejected,      // Move to filtered
    markMultipleAsRelevant,  // Bulk move to inbox
    markMultipleAsRejected,  // Bulk move to filtered
    addSenderRule,       // Add whitelist/blacklist rule
    undoLastAction,      // Undo last classification change
  } = useEmail();

  // Example: Mark email as relevant with undo toast
  const handleApprove = (emailId: string, email: EmailMessage) => {
    markAsRelevant(emailId);
    toast.success("Email moved to inbox", {
      action: {
        label: "Undo",
        onClick: () => undoLastAction(),
      },
    });
  };

  // Example: Bulk action
  const handleBulkReject = (emailIds: string[]) => {
    markMultipleAsRejected(emailIds);
    toast.success(`${emailIds.length} emails filtered`);
  };

  return (/* your JSX */);
}
```

### Adding Selection to a Custom Email Card

```typescript
function CustomEmailCard({
  email,
  isSelected = false,
  onSelect,
}: {
  email: EmailMessage;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}) {
  return (
    <Card className={cn(
      "p-4",
      isSelected && "ring-2 ring-primary bg-primary/5"
    )}>
      {onSelect && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(checked === true)}
        />
      )}
      {/* Card content */}
    </Card>
  );
}
```

### Training Filter from Sent Emails via API

```typescript
// POST /api/email/train-from-sent
const response = await fetch('/api/email/train-from-sent', {
  method: 'POST'
});

const data = await response.json();
// Response:
// {
//   success: true,
//   stats: {
//     totalRecipientsFound: 150,
//     uniqueDomainsFound: 45,
//     alreadyWhitelisted: 10,
//     newDomainsWhitelisted: 35,
//     skippedPublicDomains: 50
//   },
//   newDomains: ["clientcompany.com", "partnerfirm.com", ...]
// }
```

### Managing Kanban Columns via API

```typescript
// GET current column configuration
const getColumns = await fetch('/api/email/kanban-columns');
const { columns } = await getColumns.json();
// columns: [{ id: "pending", title: "New", color: "bg-blue-500", order: 0 }, ...]

// PUT - Save new column configuration (admin only)
const saveColumns = await fetch('/api/email/kanban-columns', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    columns: [
      { id: "pending", title: "New", color: "bg-blue-500", order: 0 },
      { id: "review", title: "Needs Review", color: "bg-amber-500", order: 1 },
      { id: "in_progress", title: "In Progress", color: "bg-violet-500", order: 2 },
      { id: "completed", title: "Done", color: "bg-emerald-500", order: 3 },
    ]
  })
});

// DELETE - Reset to default columns (admin only)
const resetColumns = await fetch('/api/email/kanban-columns', {
  method: 'DELETE'
});
```

---

## Database Tables

### email_training_feedback
Stores user corrections to improve classification:
```sql
CREATE TABLE email_training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email_message_id TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_domain TEXT NOT NULL,
  subject TEXT,
  original_classification TEXT NOT NULL,  -- 'relevant' or 'rejected'
  user_classification TEXT NOT NULL,       -- 'relevant' or 'rejected'
  original_category TEXT,
  created_by UUID REFERENCES auth.users(id)
);
```

### email_sender_rules
Stores whitelist/blacklist rules:
```sql
CREATE TABLE email_sender_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  rule_type TEXT NOT NULL,      -- 'email' or 'domain'
  match_type TEXT NOT NULL,     -- 'exact', 'contains', 'ends_with'
  match_value TEXT NOT NULL,
  action TEXT NOT NULL,         -- 'whitelist' or 'blacklist'
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(rule_type, match_type, match_value)
);
```

---

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Microsoft OAuth (for email)
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:2050
```

---

## API Endpoints

### Email APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email/accounts` | GET | List connected email accounts |
| `/api/email/connect` | GET | Initiate OAuth flow |
| `/api/email/callback` | GET | OAuth callback handler |
| `/api/email/disconnect` | DELETE | Disconnect email account |
| `/api/email/inbox` | GET | Fetch emails from inbox |
| `/api/email/training` | GET | Get learned patterns |
| `/api/email/training` | POST | Submit training feedback |
| `/api/email/sender-rules` | GET | List sender rules |
| `/api/email/sender-rules` | POST | Create sender rule |
| `/api/email/sender-rules?id=` | DELETE | Delete sender rule |
| `/api/email/train-from-sent` | POST | Auto-whitelist domains from sent emails |
| `/api/email/train-from-sent` | GET | Get auto-whitelist training stats |
| `/api/email/kanban-columns` | GET | Get kanban column configuration |
| `/api/email/kanban-columns` | PUT | Save kanban column configuration (admin) |
| `/api/email/kanban-columns` | DELETE | Reset columns to defaults (admin) |

---

## Troubleshooting

### Emails not loading
1. Check that Microsoft OAuth is configured correctly
2. Verify the account is connected in System Settings
3. Check browser console for API errors

### Classification seems wrong
1. Mark emails correctly to train the system
2. Add sender rules for persistent patterns
3. Check if domain is in the spam blocklist in `email-classifier.ts`

### Bulk selection not working
1. Ensure you're on the Inbox or Filtered tab
2. Check that emails are visible (not filtered by account/category)
3. Selections clear when switching tabs

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── email/
│   │       └── page.tsx              # Email page with Kanban board
│   └── api/
│       └── email/
│           ├── accounts/route.ts
│           ├── connect/route.ts
│           ├── callback/route.ts
│           ├── disconnect/route.ts
│           ├── inbox/route.ts
│           ├── training/route.ts
│           ├── sender-rules/route.ts
│           ├── train-from-sent/route.ts  # Auto-whitelist from sent emails
│           └── kanban-columns/route.ts   # Kanban column configuration
├── lib/
│   └── email/
│       ├── index.ts              # Exports
│       ├── email-context.tsx     # React context & state
│       ├── email-classifier.ts   # Classification logic
│       └── types.ts              # TypeScript types
```

---

## Recent Changes

### Kanban Column Customization (Dec 2024)
- Admin users can now fully customize Kanban board columns
- Add, remove, rename, and reorder columns
- Choose from 10 color options for each column
- Reset to defaults option
- Column configuration persists for all users via `app_settings` table
- Tasks in deleted columns automatically move to first column

### Auto-Train Filter from Sent Emails (Dec 2024)
- New "Train Filter" button for admins in email page header
- Scans sent emails to extract recipient domains
- Automatically whitelists business domains (skips gmail.com, yahoo.com, etc.)
- Shows stats on how many domains were whitelisted
- Ensures replies from your contacts won't be filtered as spam

### Email Training & Bulk Actions (Dec 2024)
- Added shared training feedback system across all users
- Bulk selection for emails (select multiple, filter/approve all)
- Sender whitelist/blacklist rules
- Undo toast notifications for classification changes
- Training data persists to database for ML improvement
