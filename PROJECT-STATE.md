---
project: Spencer McGaw CPA Hub
type: business
created: 2024-12-16
updated: 2024-12-16
phase: 4-BUILD
progress: 70%
mode: standard
---

## Decisions
- Stack: Next.js 16 + Supabase + Drizzle ORM (2024-12)
- Phone Integration: GoTo Connect via OAuth + Webhooks (2024-12)
- Email Integration: Microsoft Graph API (2024-12)
- AI Parsing: OpenAI for webhook/email analysis (2024-12)

## Completed
- [x] Core authentication and user management
- [x] Dashboard layout with sidebar navigation
- [x] Task management system with kanban
- [x] Calendar integration (Google Calendar)
- [x] Email intelligence system (classify, action items, kanban)
- [x] AI Phone Agent with GoTo Connect integration
- [x] Webhook handling with AI parsing
- [x] Phone line/user info on call cards
- [x] Recording notification subscriptions added
- [x] Chat/messaging system
- [x] SMS integration tables
- [x] CRM tables created (client_contacts, client_services, tax_filings, etc.)
- [x] Project tables created (projects, project_tasks, project_templates)
- [x] Default project templates seeded (1040, 1120, 1065, Bookkeeping)
- [x] CRM Client detail page (contacts, services, tax history, deadlines, activity, SMS tabs)
- [x] Projects page with kanban + list views
- [x] Projects API routes (CRUD, tasks, templates)
- [x] GoTo disconnect functionality added
- [x] Wire email/phone to CRM entities
  - Added client_id to email_classifications table
  - Auto-match phone calls to clients via phone number
  - Client communications API (/api/clients/[id]/communications)
  - Calls/Emails tab on client detail page with full history
  - Unified communications view (calls + emails sorted by date)

## In Progress
- [ ] GoTo recordings/transcripts - User re-authorizing with new scopes

## Remaining
- [ ] Project detail page with tasks/timeline
- [ ] Analytics dashboard
- [ ] Document intake system
- [ ] Reports/export functionality

## Blockers
- GoTo recordings: User was sent reconnect link with new recording scopes

## Integrations
- [x] Configured: Supabase (auth, database, storage)
- [x] Configured: GoTo Connect (OAuth, webhooks, disconnect/reconnect)
- [x] Configured: Microsoft Graph (email)
- [x] Configured: OpenAI (AI parsing)
- [ ] Pending: Full recording/transcription from GoTo (awaiting re-auth)

## User Preferences
detail: concise
autonomy: high

## Tech Stack
- Frontend: Next.js 16, React, TailwindCSS, shadcn/ui
- Backend: Next.js API routes, Drizzle ORM
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Deployment: Vercel

## Database Tables (CRM)
- clients (enhanced with entity_type, EIN, etc.)
- client_contacts
- client_notes
- client_services
- client_tax_filings
- client_document_requests
- client_deadlines
- client_communications
- client_relationships
- client_financial_summary
- contacts
- projects
- project_tasks
- project_templates
- project_template_tasks
- project_notes
- project_documents
- email_classifications (enhanced with client_id, matched_at, match_method)
- client_communications_unified (view: unified calls + emails per client)
