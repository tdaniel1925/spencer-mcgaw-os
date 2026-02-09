# E2E Test Setup Guide

This guide explains how to set up and run Playwright E2E tests for the Spencer-McGaw Hub application.

## Prerequisites

1. **Supabase Project** - You need access to the Supabase dashboard
2. **Test User** - A dedicated test user account in Supabase
3. **Environment Variables** - Test credentials configured

## Step 1: Create Test User in Supabase

You have two options to create a test user:

### Option A: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** → **"Create new user"**
4. Fill in the details:
   - **Email**: `test@spencermcgaw.com`
   - **Password**: `TestPassword123!`
   - **Auto Confirm User**: ✅ (checked)
5. Click **"Create User"**

### Option B: Using SQL (Advanced)

Run this SQL in the Supabase SQL Editor:

```sql
-- Create test user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@spencermcgaw.com',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test User"}',
  NOW(),
  NOW()
);
```

## Step 2: Configure Environment Variables

The test credentials are already configured in `.env.test`:

```bash
TEST_USER_EMAIL=test@spencermcgaw.com
TEST_USER_PASSWORD=TestPassword123!
```

If you used different credentials, update `.env.test` accordingly.

## Step 3: Install Playwright Browsers (First Time Only)

If you haven't installed Playwright browsers yet:

```bash
npx playwright install chromium
```

## Step 4: Run the Tests

### Run all E2E tests:

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive):

```bash
npx playwright test --ui
```

### Run specific test file:

```bash
npx playwright test tests/e2e/clients.spec.ts
```

### View test report:

```bash
npx playwright show-report
```

## How Authentication Works

1. **First Run**: The `auth.setup.ts` file runs before all tests
   - Logs in with test credentials
   - Saves authentication state to `playwright/.auth/user.json`

2. **Subsequent Tests**: All tests reuse the saved auth state
   - No need to log in for each test
   - Tests run as an authenticated user
   - Can access protected routes like `/dashboard`, `/clients`, etc.

3. **Auth State**: Stored in `playwright/.auth/user.json`
   - Automatically recreated if deleted
   - Not committed to git (in `.gitignore`)
   - Valid as long as the session is active in Supabase

## Troubleshooting

### Tests failing with "element not found"

**Problem**: The application might not have finished loading.

**Solution**: The tests include proper waits. If issues persist, check:
- Is the dev server running? (`npm run dev`)
- Is the test user created in Supabase?
- Are the credentials in `.env.test` correct?

### Authentication setup fails

**Problem**: Can't log in with test credentials.

**Solution**: Verify the test user exists:
1. Go to Supabase Dashboard → Authentication → Users
2. Look for `test@spencermcgaw.com`
3. If it doesn't exist, create it (see Step 1)
4. Ensure "Email Confirmed" is checked

### "storageState" file not found

**Problem**: Missing `playwright/.auth/user.json`

**Solution**: The auth setup will recreate it automatically on next run. Just run:
```bash
npm run test:e2e
```

### Tests passing locally but failing in CI

**Problem**: CI environment doesn't have test user.

**Solution**:
1. Ensure your CI has access to the same Supabase project
2. Add `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` to CI secrets
3. Ensure test user exists in that Supabase project

## Test Structure

```
tests/
├── e2e/
│   ├── auth.setup.ts         # Authentication setup (runs first)
│   ├── admin.spec.ts          # Admin pages tests
│   ├── auth.spec.ts           # Authentication flow tests
│   ├── calls.spec.ts          # Phone agent tests
│   ├── clients.spec.ts        # Client management tests
│   ├── dashboard.spec.ts      # Dashboard tests
│   ├── email.spec.ts          # Email tests
│   ├── recordings.spec.ts     # Recordings tests
│   └── tasks.spec.ts          # Task management tests
└── unit/                      # Unit tests (Vitest)
```

## Best Practices

1. **One Test User**: Use a dedicated test user, not a production user
2. **Clean Data**: Consider resetting test data between runs if needed
3. **Isolated Tests**: Each test should be independent
4. **Descriptive Names**: Test names should describe what they're testing
5. **Wait for Elements**: Use proper waits, not arbitrary timeouts

## Security Notes

⚠️ **Important**:
- Never commit `.env.test` to public repositories
- Use different credentials for production and testing
- The `.env.test` file is already in `.gitignore`
- Test credentials should be stored securely in CI/CD

## Need Help?

If you encounter issues:
1. Check the Playwright documentation: https://playwright.dev
2. Check the test output for error messages
3. Use `--debug` flag for step-by-step debugging:
   ```bash
   npx playwright test --debug
   ```
4. Use UI mode for visual debugging:
   ```bash
   npx playwright test --ui
   ```

## Next Steps

Once tests are passing:
- Add more test scenarios as features are built
- Set up CI/CD to run tests automatically
- Add visual regression testing if needed
- Monitor test flakiness and fix unstable tests
