# EaseMail MCP Reference

## Repository
- **URL**: https://github.com/tdaniel1925/easemail-mcp
- **Status**: Early development / Demo prototype
- **Live Demo**: https://easemail-mcp.vercel.app

## Overview
EaseMail MCP is a Next.js-based email client application that provides an AI-powered email assistant interface. Currently in prototype phase with simulated email data.

## Tech Stack
- Next.js 16.0.5
- React 19.2.0
- TypeScript
- Supabase (SSR + JS Client)
- Tailwind CSS

## Current Features (Demo)
- Command processing for email tasks
- Natural language command matching
- Light/dark theme toggle
- Command history tracking
- Quick action buttons

## Simulated Commands
- View unread emails
- Check calendar events
- Compose messages

## Project Structure
```
src/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
│   └── supabase/
└── middleware.ts
```

## Integration Status

### What This Repo Provides
Currently a UI prototype - **actual email API connectivity is marked as "coming soon"**

### What Spencer McGaw Hub Uses Instead
We've implemented direct Microsoft Graph API integration:

1. **OAuth Flow** (`/api/email/connect`, `/api/email/callback`)
   - Microsoft OAuth 2.0 authentication
   - Token storage in Supabase

2. **Email Operations** (`/api/email/inbox`, `/api/email/send`)
   - Fetch emails from Microsoft Graph
   - Send emails via Graph API

3. **AI Processing** (`/api/email/process`)
   - Email classification
   - Client matching
   - Attachment extraction
   - Task creation

## Future Integration Possibilities

If easemail-mcp develops into a full MCP server, potential integration points:

1. **MCP Server Connection**
   - Add as MCP server in Claude Code configuration
   - Use for email operations via natural language

2. **Shared Authentication**
   - Could share OAuth tokens with Spencer McGaw Hub
   - Single sign-on for email access

3. **Tool Functions to Watch For**
   - `read_emails` - Fetch inbox
   - `send_email` - Compose and send
   - `search_emails` - Query mailbox
   - `get_attachments` - Download files
   - `create_draft` - Save drafts

## Environment Variables (Expected)
```env
# Microsoft Graph (if implemented)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Notes
- This repo appears to be a separate project from BotMakers MCP
- Currently doesn't provide actual MCP server functionality
- May evolve into an MCP-compatible email service

## Related Documentation
- [Microsoft Graph API Integration](./botmakers-graph-api.md) - Our direct Graph API implementation
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol specification
