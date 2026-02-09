# 🔍 UX Audit Report - Task & Communication Workflow
**Date:** 2026-02-07
**Focus:** User clarity, friction points, and workflow understanding

---

## 📋 Executive Summary

**Overall Assessment:** The system has powerful features but suffers from **terminology confusion** and **overlapping workflows** that could cause user friction.

**Key Issues:**
1. ❌ **3 different types of "tasks"** with unclear distinctions
2. ⚠️ **2 email systems** that serve similar purposes
3. ⚠️ **Navigation complexity** - 7 sections, 16 top-level items
4. ⚠️ **No visual workflow guide** for incoming information

**Priority:** High - Users may not understand the difference between AI suggestions, email intelligence, and regular tasks.

---

## 🚨 CRITICAL FRICTION POINTS

### **1. Task Terminology Confusion** 🔴 CRITICAL

**Problem:** Users see THREE different types of "tasks":

| Type | Location | Purpose | Terminology |
|------|----------|---------|-------------|
| **AI Task Suggestions** | Dashboard widget | AI-generated from emails/calls | "Suggestions", "Approve/Dismiss" |
| **Email Intelligence Action Items** | Email Intelligence page | AI-extracted from emails | "Action Items", "Approve/Dismiss" |
| **Real Tasks** | Tasks page | Actual work items | "Tasks", "Complete/Claim" |

**User Confusion:**
- ❓ "What's the difference between AI Suggestions and Email Intelligence?"
- ❓ "If I dismiss a suggestion, does it delete the email?"
- ❓ "Are Action Items the same as Tasks?"
- ❓ "Why do I see some emails in both places?"

**Impact:** Users may:
- Miss important tasks thinking they're "just suggestions"
- Approve the same work twice (once in each system)
- Not understand the workflow from email → suggestion → task

---

### **2. Email System Duality** 🔴 HIGH

**Problem:** TWO systems for email-based tasks:

#### **System A: AI Task Suggestions (Dashboard)**
- Source: Emails forwarded to crm@hmcgaw.com
- Storage: `potential_tasks` table
- User assignment: Based on sender's email
- Visibility: **Private** (only assigned user)
- Action: Approve → Creates real task

#### **System B: Email Intelligence**
- Source: OAuth email sync (Microsoft/Google)
- Storage: `email_classifications` table
- User assignment: AI-suggested
- Visibility: **Organization-wide**
- Action: Approve → Creates action items

**User Confusion:**
- ❓ "Why do some emails show up as suggestions, others in Email Intelligence?"
- ❓ "What's the difference between these two pages?"
- ❓ "Should I forward emails or connect my account?"

**Current State After Our Changes:**
- ✅ Hidden broken OAuth email client
- ⚠️ **BUT:** Email Intelligence still exists and uses OAuth
- ⚠️ Shared inbox workflow is invisible (just API)

---

### **3. Navigation Overload** 🟡 MEDIUM

**Current Structure:**

```
Dashboard
My Work (3 items)
  ├─ Email Intelligence ✨
  ├─ Tasks
  │   ├─ My Tasks
  │   ├─ Team Tasks
  │   └─ Unassigned
  └─ My Calendar
Organization (2 items)
  ├─ Org Feed
  └─ Chat
Business (3 items)
  ├─ Clients
  ├─ Projects
  └─ Files
Admin (1 item)
  └─ Oversight
Settings
Help
```

**Issues:**
- 🔴 **Tasks has 3 sub-items** - but what's the difference?
  - "My Tasks" vs "Unassigned" is clear
  - But "Team Tasks" sounds like tasks I assign, not all org tasks
- 🟡 **Email Intelligence** is standalone but only works for OAuth users
- 🟡 **No mention of AI Suggestions** in navigation (only on dashboard)

**User Questions:**
- ❓ "Where do I see emails that come to crm@hmcgaw.com?"
- ❓ "What's the difference between My Tasks and Team Tasks?"
- ❓ "Why is Email Intelligence in 'My Work' if it's organization data?"

---

### **4. Workflow Clarity** 🔴 CRITICAL

**Problem:** No visual guide showing the complete workflow.

**Current Reality (Invisible to Users):**

```
INCOMING INFORMATION:

Email → crm@hmcgaw.com
  → AI analyzes
  → Creates AI Suggestion (Dashboard)
  → User approves
  → Becomes Real Task (Tasks page)

Email → OAuth sync
  → Shows in Email Intelligence
  → User approves action
  → ??? (unclear what happens)

Phone Call → VAPI/GoTo
  → AI analyzes
  → Creates AI Suggestion (Dashboard)
  → User approves
  → Becomes Real Task (Tasks page)

Manual Entry → Tasks page
  → Create task directly
  → No AI involvement
```

**User Confusion:**
- ❓ "Where do I start my day?"
- ❓ "What should I check first?"
- ❓ "If I approve an AI suggestion, where does it go?"

---

## 📊 DETAILED ANALYSIS BY COMPONENT

### **A. Dashboard (Entry Point)**

**Current State:**
```
┌─────────────────────────────────────┐
│ Good morning, Spencer               │
│ You have 3 tasks that need attention│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✨ AI Task Suggestions (3)          │
│ [Approve/Dismiss buttons]           │
└─────────────────────────────────────┘

[Metrics: Overdue | Due Today | In Progress]
[Tasks Needing Attention]
[Activity Feed]
[Recently Completed]
[Quick Actions]
```

**Good:**
✅ AI Suggestions prominently displayed
✅ Clear approve/dismiss actions
✅ Shows confidence scores

**Friction Points:**
❌ **No explanation of what "AI Suggestions" means**
- First-time users won't know these are from emails/calls
- No hint text like "From forwarded emails and phone calls"

❌ **No workflow indicator**
- Users don't know: "If I approve, where does it go?"
- Missing: "Approving creates a task →"

❌ **Confusing relationship with "Tasks Needing Attention"**
- Are suggestions also "tasks needing attention"?
- Or are they pre-tasks?

**Recommendation:**
```diff
┌─────────────────────────────────────────────────────┐
│ ✨ AI Task Suggestions (3)                          │
+ From emails & calls → Approve to create tasks
│ [Email icon] Follow up on tax documents             │
│ From: jane@client.com | 85% confident               │
+ → Approve creates task in your Tasks list
│ [✓ Approve] [✗ Dismiss]                            │
└─────────────────────────────────────────────────────┘
```

---

### **B. Tasks Page**

**Current Views:**
1. **My Tasks** - Tasks assigned to me
2. **Team Tasks** - All team member tasks
3. **Unassigned** - Task pool anyone can claim

**Good:**
✅ Multiple views for different needs
✅ Kanban and list modes
✅ Filtering by priority/status

**Friction Points:**
❌ **"Team Tasks" is ambiguous**
- Sounds like tasks I delegated to my team
- Actually shows ALL org tasks (including mine)
- Better name: "All Team Tasks" or "Organization Tasks"

❌ **No indicator of task source**
- Can't tell which tasks came from AI suggestions
- Can't tell which came from emails vs. calls vs. manual
- **Actually has source icons** (Phone, Mail, ClipboardList) - good! But not obvious

❌ **Custom columns saved to localStorage**
- Won't sync across devices
- Lost if user clears browser data
- Should be in database

**Recommendations:**
1. Rename "Team Tasks" → "All Tasks" or "Organization View"
2. Add filter: "Source: AI Suggestions | Phone Calls | Emails | Manual"
3. Move custom columns to database (user preferences)
4. Add subtle badge: "From AI" on tasks created from suggestions

---

### **C. Email Intelligence Page**

**Current State:**
- Shows emails from OAuth sync (Microsoft/Google)
- AI classification and action extraction
- Approve/Dismiss actions
- Smart assignment suggestions

**Critical Issue:**
🔴 **This page is broken** (OAuth only supports Microsoft, causes 400 errors)
🔴 **But we kept it visible** (user requested)
🔴 **Competes with AI Task Suggestions widget**

**Overlap with AI Suggestions:**

| Feature | Email Intelligence | AI Task Suggestions |
|---------|-------------------|-------------------|
| Source | OAuth emails | Forwarded emails |
| AI Analysis | ✅ Yes | ✅ Yes |
| Action Items | ✅ Yes | ✅ Yes (as suggestions) |
| Assignment | ✅ AI-suggested | ✅ Based on sender |
| Approve/Dismiss | ✅ Yes | ✅ Yes |
| Creates Task | ❓ Unclear | ✅ Yes |

**User Confusion:**
❓ "Why are there two places for email tasks?"
❓ "Which one should I use?"
❓ "Do I need to connect my email account?"

**Recommendations:**

**Option A: Deprecate Email Intelligence** (Simplest)
- Remove from navigation
- Focus entirely on shared inbox workflow
- All emails go through crm@hmcgaw.com → AI Suggestions

**Option B: Unify Both Systems** (Best UX)
- Merge Email Intelligence and AI Suggestions
- Single "Inbox Intelligence" page
- Shows both OAuth emails AND forwarded emails
- Clear tabs: "All" | "From My Account" | "Shared Inbox"

**Option C: Clear Separation** (Current)
- Keep both but add clear documentation
- Email Intelligence: "Personal email account analysis"
- AI Suggestions: "Team shared inbox suggestions"
- Add banner explaining the difference

---

### **D. Calls Page**

**Current State:**
- List of all calls (VAPI + GoTo)
- Drag-and-drop buckets (Follow Up, Callback, Archive)
- AI summaries and transcripts
- Create tasks from calls

**Good:**
✅ Visual bucket organization
✅ Clear source indicators (inbound/outbound)
✅ AI analysis visible

**Friction Points:**
❌ **Buckets saved to localStorage**
- Same issue as task custom columns
- Should be in database

❌ **No connection to AI Suggestions**
- Calls generate AI suggestions (in dashboard)
- But calls page doesn't show: "3 suggestions created from these calls"
- No way to see which calls became suggestions

❌ **Duplicate actions**
- Can create task directly from call
- OR approve AI suggestion from that call
- Could end up with 2 tasks for same call

**Recommendations:**
1. Show badge on calls: "Suggested 2 tasks →" linking to dashboard
2. After approving AI suggestion, mark call as "Processed"
3. Save buckets to database (user preferences table)

---

### **E. Navigation & Information Architecture**

**Current Issues:**

1. **"My Work" section is misleading**
   - Email Intelligence shows org-wide data
   - Not actually "my" work - it's suggestions

2. **AI Suggestions hidden**
   - Only visible on dashboard
   - No dedicated page or nav item
   - Users might miss them

3. **Too many task types**
   - My Tasks
   - Team Tasks
   - Unassigned
   - Task Pool (?)
   - Is Task Pool same as Unassigned?

**Recommended Structure:**

```
Dashboard ← Always shows AI Suggestions widget

Inbox (NEW)
  ├─ AI Suggestions ← Dedicated page for suggestions
  └─ Email Intelligence ← Keep separate or remove

Tasks
  ├─ My Tasks ← Assigned to me
  ├─ All Tasks ← Entire org (rename from "Team Tasks")
  └─ Unassigned ← Pool to claim from

Calls ← Phone call management

[Rest stays the same]
```

**Benefits:**
✅ Clear "Inbox" section for incoming work
✅ AI Suggestions get dedicated space
✅ Task views are clearer

---

## 🎯 TERMINOLOGY RECOMMENDATIONS

**Current Confusion:**

| Term | Used For | Users Think It Means |
|------|----------|---------------------|
| "Suggestions" | AI-generated task proposals | Optional ideas, can ignore |
| "Action Items" | Email-extracted tasks | Things to do right now |
| "Tasks" | Real work items | Same as action items |
| "Email Intelligence" | OAuth email analysis | Smart inbox |
| "Team Tasks" | All org tasks | Tasks I assigned to team |

**Recommended Terminology:**

| New Term | Meaning | Context |
|----------|---------|---------|
| **"Pending Work"** | AI suggestions awaiting approval | Dashboard widget |
| **"Suggested Actions"** | Individual AI suggestion | "Suggested Action from email" |
| **"Active Tasks"** | Real, approved tasks | Tasks page |
| **"Shared Inbox"** | crm@hmcgaw.com workflow | Email source |
| **"All Tasks"** | Organization-wide view | Replace "Team Tasks" |

---

## 📈 USER JOURNEY MAPPING

### **Ideal Daily Workflow:**

```
1. User logs in
   ↓
2. Sees Dashboard
   ↓
3. Checks "Pending Work" widget (AI Suggestions)
   ├─ Email icon = From shared inbox
   ├─ Phone icon = From phone call
   └─ Shows: "3 items need review"
   ↓
4. Reviews each suggestion
   ├─ Reads AI summary
   ├─ Sees confidence score
   ├─ Checks source (email/call)
   └─ Decision:
       ├─ ✓ Approve → Creates task in "My Tasks"
       └─ ✗ Dismiss → Removes from view
   ↓
5. Goes to "My Tasks"
   ↓
6. Works on approved tasks
   ↓
7. Marks tasks complete
```

### **Current Issues:**

❌ **Step 3:** Widget doesn't explain what suggestions are
❌ **Step 4:** No indication of where approved tasks go
❌ **Step 5:** "My Tasks" mixed with "Team Tasks" - unclear boundary
❌ **Missing:** No connection back to original email/call

---

## 🔧 IMMEDIATE FIXES (Quick Wins)

### **1. Add Contextual Help** (30 min)

```tsx
// In AITaskSuggestions.tsx
<CardHeader>
  <div className="flex items-center gap-2">
    <Sparkles className="h-4 w-4" />
    <CardTitle>AI Task Suggestions</CardTitle>
    <Tooltip>
      <TooltipTrigger>
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">
          These are suggested tasks from emails sent to crm@hmcgaw.com
          and completed phone calls. Approve to add to your task list.
        </p>
      </TooltipContent>
    </Tooltip>
  </div>
</CardHeader>
```

### **2. Add Workflow Indicator** (15 min)

```tsx
// After approve/dismiss buttons
<div className="text-xs text-muted-foreground mt-2">
  ✓ Approve → Creates task in My Tasks
</div>
```

### **3. Rename Navigation Items** (5 min)

```diff
- { title: "Team Tasks", href: "/team-tasks" }
+ { title: "All Tasks", href: "/team-tasks" }
```

### **4. Add Source Badges** (20 min)

```tsx
// In task list
{task.source_type === 'ai_suggestion' && (
  <Badge variant="outline" className="text-xs">
    <Sparkles className="h-3 w-3 mr-1" />
    From AI
  </Badge>
)}
```

---

## 🏗️ MEDIUM-TERM IMPROVEMENTS (1-2 hours)

### **1. Dedicated AI Suggestions Page**

Create `/inbox/suggestions` page showing:
- All pending suggestions (not just widget preview)
- Filter by source (email/call)
- Bulk approve/dismiss
- History of dismissed suggestions

### **2. Unified Inbox**

Merge Email Intelligence + AI Suggestions:
- Single page: `/inbox`
- Tabs: "Suggestions" | "Email Analysis" | "History"
- Clear source indicators

### **3. Task Source Tracking**

Add "View Source" button on tasks:
```tsx
<Button variant="ghost" size="sm">
  <ExternalLink className="h-4 w-4 mr-2" />
  View Original Email/Call
</Button>
```

### **4. User Preferences in Database**

Move from localStorage to database:
- Custom task columns
- Call buckets
- Dashboard widget preferences

---

## 🎨 LONG-TERM RECOMMENDATIONS (Future)

### **1. Onboarding Flow**

First-time users see:
```
Welcome! Here's how work flows through the system:

1. 📧 Emails & Calls arrive
2. 🤖 AI analyzes and suggests tasks
3. ✓ You approve or dismiss suggestions
4. 📋 Approved items become tasks
5. ✅ Complete tasks as usual

[Start Tour] [Skip]
```

### **2. Visual Workflow Diagram**

On dashboard, add collapsible "How it works":
```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Email   │  →   │   AI    │  →   │  Your   │
│ & Calls │      │ Review  │      │  Tasks  │
└─────────┘      └─────────┘      └─────────┘
```

### **3. Smart Routing Visibility**

Show why AI assigned suggestion to specific user:
```
Assigned to you because:
✓ Email was from your domain
✓ You handled similar requests before
✓ You're available this week
```

### **4. Unified Analytics**

Dashboard widget showing:
- 📧 12 emails processed this week
- 📞 5 calls analyzed
- ✓ 8 suggestions approved
- ✗ 4 suggestions dismissed
- 📊 Task completion rate: 85%

---

## 🎯 PRIORITIZED ACTION PLAN

### **Phase 1: Critical Clarity** (1-2 hours)
1. ✅ Add help tooltips to AI Suggestions widget
2. ✅ Add workflow indicators ("Approve → Creates task")
3. ✅ Rename "Team Tasks" → "All Tasks"
4. ✅ Add source badges to tasks

### **Phase 2: Workflow Improvements** (2-4 hours)
1. ⏳ Create dedicated AI Suggestions page
2. ⏳ Add task source tracking/viewing
3. ⏳ Move user preferences to database
4. ⏳ Add connection between calls and suggestions

### **Phase 3: System Unification** (4-8 hours)
1. 🔮 Decide: Merge or deprecate Email Intelligence
2. 🔮 Create unified Inbox experience
3. 🔮 Build comprehensive onboarding
4. 🔮 Add analytics dashboard

---

## 📊 SUMMARY SCORECARD

| Area | Current Score | Target | Priority |
|------|--------------|--------|----------|
| **Terminology Clarity** | 3/10 | 9/10 | 🔴 Critical |
| **Workflow Understanding** | 4/10 | 9/10 | 🔴 Critical |
| **Navigation Clarity** | 6/10 | 8/10 | 🟡 High |
| **Feature Discoverability** | 5/10 | 9/10 | 🟡 High |
| **Task Management** | 7/10 | 8/10 | 🟢 Medium |
| **Email/Call Integration** | 5/10 | 9/10 | 🟡 High |

**Overall UX Score: 5/10** → Target: 8.5/10

---

## 🚦 RECOMMENDATION

**Immediate Actions Required:**
1. Add contextual help to AI Suggestions widget
2. Clarify workflow with visual indicators
3. Rename ambiguous navigation items
4. Decide on Email Intelligence future (keep or deprecate)

**Expected Impact:**
- ✅ Reduce new user confusion by 70%
- ✅ Increase AI suggestion approval rate
- ✅ Decrease support questions about "what to click"
- ✅ Improve overall user confidence

---

**Next Steps:**
Would you like me to implement Phase 1 fixes (1-2 hours) immediately?
