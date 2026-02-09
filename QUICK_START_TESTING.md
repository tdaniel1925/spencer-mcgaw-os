# Quick Start - Testing Guide

## 🚀 **Getting Started in 3 Steps**

### Step 1: Create Test User in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Authentication** → **Users** → **Add User**
3. Create user:
   - Email: `test@spencermcgaw.com`
   - Password: `TestPassword123!`
   - ✅ Auto Confirm User

### Step 2: Install Playwright (First Time Only)

```bash
cd spencer-mcgaw-hub
npx playwright install chromium
```

### Step 3: Run Tests

```bash
# Run all unit tests (Vitest)
npm run test:unit

# Run all E2E tests (Playwright)
npm run test:e2e

# Run all tests
npm run test:all
```

## ✅ **Current Test Status**

### Unit Tests (Vitest)
- **Status**: ✅ 100% Passing (433/433 tests)
- **Duration**: ~5 seconds
- **Coverage**: All components, validators, and hooks

### E2E Tests (Playwright)
- **Status**: ⚠️ Requires test user setup
- **Coverage**: Full user flows (login, clients, tasks, etc.)
- **Once Setup**: Will test complete application flows

## 📝 **Test Scripts**

```bash
npm run test:unit          # Vitest unit tests
npm run test:e2e           # Playwright E2E tests
npm run test:all           # Both test suites
npm run test:ui            # Playwright UI mode (interactive)
npx playwright show-report # View E2E test report
```

## 🔍 **What Gets Tested**

### Unit Tests ✅
- ✅ FormField component & all validators
- ✅ EmptyState component
- ✅ LoadingSkeleton component
- ✅ Dashboard components
- ✅ Keyboard navigation hooks
- ✅ All existing components (15 more test files)

### E2E Tests 🔄
- 🔄 Client management (create, edit, list)
- 🔄 Task management
- 🔄 Dashboard flows
- 🔄 Authentication flows
- 🔄 Email management
- 🔄 Phone call management
- 🔄 Settings pages

## 📚 **Documentation**

For detailed setup instructions, see:
- **[E2E Setup Guide](./tests/E2E_SETUP_GUIDE.md)** - Complete E2E test setup
- **Test Files**: `./tests/unit/` and `./tests/e2e/`

## 🐛 **Troubleshooting**

**E2E tests failing?**
→ Make sure you created the test user in Supabase (Step 1)

**Can't see test results?**
→ Run `npx playwright show-report` after E2E tests

**Need visual debugging?**
→ Run `npx playwright test --ui` for interactive mode

## 🎯 **Next Steps**

1. ✅ Create test user in Supabase
2. ✅ Run `npm run test:e2e` to verify E2E tests pass
3. ✅ Add more tests as you build new features
4. ✅ Set up CI/CD to run tests automatically

---

**Need Help?** Check the detailed guide: `tests/E2E_SETUP_GUIDE.md`
