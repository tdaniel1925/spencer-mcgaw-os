# Spencer McGaw CPA Hub

Business Operating System for Spencer McGaw CPA - a comprehensive platform for managing clients, tasks, communications, and documents.

## Features

- **Client Management (CRM)** - Full client lifecycle management with contacts, services, tax filings, and deadlines
- **Task Management** - Kanban boards, task assignment, AI-powered task suggestions
- **Communication Hub** - Integrated phone calls (GoTo Connect), emails (Microsoft 365), and SMS (Twilio)
- **Document Intake** - AI-powered document classification and processing
- **Team Chat** - Real-time messaging with presence indicators
- **Analytics & Reports** - Business intelligence and exportable reports
- **AI Features** - Smart task extraction, email classification, caller ID enrichment

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **Auth**: Supabase Auth
- **UI**: shadcn/ui + Tailwind CSS
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Supabase project

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables:
   ```env
   # Required
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   DATABASE_URL=your_database_url

   # Optional integrations
   OPENAI_API_KEY=your_openai_key
   GOTO_CLIENT_ID=your_goto_client_id
   GOTO_CLIENT_SECRET=your_goto_secret
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token

   # Error tracking (optional)
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   ```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npx drizzle-kit push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main application pages
│   ├── (fullpage)/        # Full-page layouts (kanban boards)
│   ├── (public)/          # Public pages (terms, privacy)
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   └── dashboard/        # Dashboard-specific components
├── lib/                   # Utilities and services
│   ├── ai/               # AI integrations
│   ├── supabase/         # Supabase clients
│   ├── goto/             # GoTo Connect integration
│   ├── twilio/           # Twilio integration
│   └── email/            # Email services
├── db/                    # Database schema (Drizzle)
└── hooks/                 # Custom React hooks
```

## API Routes

Key API endpoints:

- `/api/health` - Health check endpoint
- `/api/tasks/*` - Task CRUD operations
- `/api/clients/*` - Client management
- `/api/projects/*` - Project management
- `/api/sms/*` - SMS functionality
- `/api/chat/*` - Team chat
- `/api/webhooks/*` - Webhook handlers (GoTo, Twilio)

## Security

- TypeScript strict mode enabled
- Zod validation on API routes
- Rate limiting on all endpoints
- CSP headers configured
- Row-level security (RLS) via Supabase
- Error tracking via Sentry

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure tests pass: `npm run test`
4. Ensure TypeScript passes: `npx tsc --noEmit`
5. Create a pull request

## Deployment

The application is deployed to Vercel with automatic deployments:

- `main` branch → Production
- Pull requests → Preview deployments

### Required Secrets

For CI/CD to work, add these secrets to GitHub:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## License

Private - All rights reserved.
