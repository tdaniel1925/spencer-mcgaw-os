# Users Section Overhaul Plan

## Current Problems

### 1. Fragmented Settings
- **Personal settings** split between `/settings` and `/admin/users`
- Department and job_title editable in admin panel but not in personal settings
- No clear distinction between "my settings" and "admin managing other users"

### 2. Missing Critical Features
- **No password change** - Users cannot change their own passwords after creation
- **Email accounts confusion** - Unclear difference between personal vs global email accounts
- **No personal email management** - Users can't easily add their own email addresses

### 3. Confusing Admin Interface
- Admin users page tries to do too much (create, edit, permissions, bulk upload)
- Permission overrides buried in a modal
- No clear user detail view

---

## Proposed Architecture

### New Navigation Structure

```
SIDEBAR (Personal Section)
├── Dashboard
├── My Inbox (personal email classifications)
├── My Tasks (personal kanban)
├── Calendar
└── Settings ← PERSONAL SETTINGS (expanded)
    ├── Profile (name, phone, avatar, bio)
    ├── My Email Accounts (add/manage personal emails)
    ├── Notifications (all 23 preferences)
    ├── Security (password change)
    └── Privacy (who can see my stuff)

SIDEBAR (Team Section)
├── Org Feed (calls + global emails)
├── Org Tasks (unassigned tasks kanban)
├── Chat
└── Clients

SIDEBAR (Admin Section) - Admin/Owner only
├── Manage Users ← SIMPLIFIED
│   ├── User list with quick actions
│   └── User detail page (new)
├── User Workload
├── Oversight
├── AI Learning
└── Global Settings
    ├── Company Info
    ├── Global Email Accounts
    ├── SMS Settings
    └── Integrations
```

---

## Implementation Plan

### Phase 1: Personal Settings Overhaul (Priority: HIGH)

#### 1.1 Expand Settings Page Tabs

**Current tabs:** Profile, Company, Notifications, Security, Integrations

**New tabs:**
1. **Profile** - Personal info (name, phone, avatar, bio, department display)
2. **My Email Accounts** - Personal email connections (moved from Integrations)
3. **Notifications** - All notification preferences (keep as-is)
4. **Security** - Password change (implement), 2FA (future)
5. **Privacy** - Who can see my tasks, availability, etc.

#### 1.2 Implement Password Change API

Create `PATCH /api/settings/password`:
```typescript
{
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
}
```

Validation:
- Verify current password
- New password meets strength requirements
- New !== current

#### 1.3 My Email Accounts Tab

Move email account management from Integrations tab to dedicated tab:
- List user's personal email accounts
- "Connect Email" button (Microsoft 365)
- Per-account settings:
  - Display name
  - AI auto-classify toggle
  - Sync folders selection
  - Disconnect button
- Clear visual: "These are YOUR personal email accounts"

#### 1.4 Separate Global Settings

Move Company Settings to `/admin/settings` (admin only):
- Company Info
- Global Email Accounts (shared with team)
- SMS Settings link
- VAPI Settings link

---

### Phase 2: Admin Users Simplification (Priority: HIGH)

#### 2.1 Simplify User List Page (`/admin/users`)

**Remove from main page:**
- Permission override modal (move to user detail)
- Inline editing (move to user detail)
- Bulk upload (move to separate page or modal)

**Keep on main page:**
- User table with: Name, Email, Role, Department, Status, Last Active
- Quick actions: Activate/Deactivate, View Details
- Filters: Role, Status, Department, Search
- "Add User" button

#### 2.2 New User Detail Page (`/admin/users/[id]`)

Create dedicated page for managing a single user:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Users    [Deactivate User] [Delete User]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Avatar]  John Smith                                       │
│            john@company.com                                 │
│            Role: Staff  •  Department: Accounting           │
│            Last login: 2 hours ago                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Profile] [Permissions] [Activity] [Email Accounts]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Profile Tab:                                               │
│  - Full Name: [____________]                                │
│  - Role: [Dropdown________]                                 │
│  - Department: [Dropdown__]                                 │
│  - Job Title: [___________]                                 │
│  - Phone: [_______________]                                 │
│  - Show in TaskPool: [✓]                                    │
│  - Active: [✓]                                              │
│                                                             │
│  [Save Changes]                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Permissions Tab:                                           │
│  Visual permission matrix with override toggles             │
│  (Currently in modal - move here)                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Activity Tab:                                              │
│  Recent actions by this user from activity_log              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Email Accounts Tab: (Admin view of user's accounts)        │
│  See what email accounts this user has connected            │
│  Option to make user's account global                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3 Add User Flow

Keep "Add User" dialog but simplify:
1. Email (required)
2. Full Name (required)
3. Temporary Password (required) + "Generate Random" button
4. Role (required)
5. Department (optional)
6. [Create User]

After creation:
- Show success with "Send Welcome Email" option
- Option to go to user detail page to configure permissions

---

### Phase 3: Email Account Clarity (Priority: MEDIUM)

#### 3.1 Clear Personal vs Global Distinction

**In Settings > My Email Accounts:**
```
┌─────────────────────────────────────────────────────────────┐
│ My Email Accounts                                           │
│                                                             │
│ These email accounts are connected to YOUR inbox.           │
│ Emails from these accounts appear in "My Inbox".            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📧 john@company.com                    [Disconnect]     │ │
│ │    Microsoft 365 • Last synced: 5 min ago              │ │
│ │    [⚙️ Settings]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Connect Email Account]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**In Admin > Global Settings > Global Email Accounts:**
```
┌─────────────────────────────────────────────────────────────┐
│ Global Email Accounts                                       │
│                                                             │
│ These email accounts are shared across the organization.    │
│ Emails appear in "Org Feed" for the whole team.            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📧 info@spencermcgaw.com              [Settings]        │ │
│ │    Microsoft 365 • Owner: Admin                         │ │
│ │    Description: Main company inbox                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Add Global Email Account]                                │
│                                                             │
│ Note: You can promote a personal account to global         │
│ from Admin > Users > [User] > Email Accounts               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Missing Features (Priority: MEDIUM)

#### 4.1 Implement Last Login Tracking

Add to auth flow:
```typescript
// On successful login
await supabase
  .from("user_profiles")
  .update({ last_login: new Date().toISOString() })
  .eq("id", user.id);
```

#### 4.2 User Activity Feed

Create `GET /api/admin/users/[id]/activity`:
- Return recent activity_log entries for user
- Show on user detail page Activity tab

#### 4.3 Welcome Email

Create email template and send on user creation:
- "Welcome to Spencer McGaw Hub"
- Your email: xxx
- Temporary password: xxx
- Please change your password on first login

---

### Phase 5: Data Integrity (Priority: HIGH)

#### 5.1 User Deletion Handling

When deleting a user, offer options:
1. **Reassign data** - Transfer tasks/clients to another user
2. **Archive user** - Soft delete, keep data but deactivate account
3. **Full delete** - Hard delete with data cleanup warning

#### 5.2 Audit Logging

Log all admin actions:
```typescript
interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: "user_created" | "user_updated" | "user_deleted" | "permission_changed" | ...;
  target_user_id: string;
  changes: Record<string, { old: any; new: any }>;
  created_at: string;
}
```

---

## File Changes Summary

### New Files to Create
1. `src/app/(dashboard)/admin/users/[id]/page.tsx` - User detail page
2. `src/app/(dashboard)/admin/settings/page.tsx` - Global settings page
3. `src/app/api/settings/password/route.ts` - Password change API
4. `src/app/api/admin/users/[id]/activity/route.ts` - User activity API

### Files to Modify
1. `src/app/(dashboard)/settings/page.tsx` - Add My Email Accounts tab, implement Security
2. `src/app/(dashboard)/admin/users/page.tsx` - Simplify, remove inline editing
3. `src/components/layout/sidebar.tsx` - Update navigation structure
4. `src/app/api/email/accounts/route.ts` - Add clearer personal/global filtering

### Files to Remove/Deprecate
- None (maintain backwards compatibility)

---

## Implementation Order

1. **Week 1: Password Change & Security**
   - Implement password change API
   - Update Security tab in Settings
   - Add password validation

2. **Week 2: Settings Reorganization**
   - Move email accounts to own tab
   - Add Privacy tab (placeholder)
   - Separate Company settings for admin only

3. **Week 3: Admin Users Overhaul**
   - Create user detail page
   - Move permissions to detail page
   - Simplify user list

4. **Week 4: Email Clarity & Polish**
   - Clear personal vs global UI
   - Add last login tracking
   - Add user activity feed
   - Welcome email on creation

---

## Success Criteria

After implementation:
- [ ] Any user can change their own password
- [ ] Users have dedicated "My Email Accounts" tab in settings
- [ ] Clear visual distinction between personal and global email
- [ ] Admin users page is simple list with "View Details" action
- [ ] User detail page shows profile, permissions, activity, email accounts
- [ ] All users have their own working login
- [ ] Last login time is tracked and displayed
- [ ] Admin actions are logged
