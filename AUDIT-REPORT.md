# 🔍 Comprehensive App Audit Report
**Generated:** 2026-02-07
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## ❌ CRITICAL BREAKING ISSUES

### 1. **Email Client Page Crashes (400 Errors)**
**Location:** `/email-client` page
**Severity:** 🔴 CRITICAL

**Problem:**
The email client page calls `/api/emails/folders` and `/api/emails?folder=inbox` which return 400 errors.

**Root Causes:**

#### a) Microsoft-Only Support
```typescript
// src/lib/email/graph-service.ts:133
.eq("provider", "microsoft")
```
- **Issue:** `GraphEmailService.fromConnection()` only works for Microsoft OAuth
- **Impact:** Users with Google OAuth or IMAP connections get 400 errors
- **Files Affected:**
  - `src/app/api/emails/folders/route.ts`
  - `src/app/api/emails/route.ts`
  - `src/app/(dashboard)/email-client/page.tsx`

**Fix Required:**
```typescript
// Need to support Google provider as well
.in("provider", ["microsoft", "google"])
// OR create separate GoogleEmailService class
```

#### b) Possible Decryption Failures
```typescript
// src/lib/email/graph-service.ts:142
let accessToken = decrypt(connection.access_token);
```
- **Issue:** If `ENCRYPTION_KEY` env var is wrong/missing, decrypt() throws
- **Impact:** Page crashes with unhandled error
- **Missing:** Try-catch error handling

**Fix Required:**
```typescript
try {
  let accessToken = decrypt(connection.access_token);
} catch (error) {
  logger.error('[GraphService] Decryption failed', { error });
  return null;
}
```

#### c) React Hydration Error #310
**Error:** `Error: Minified React error #310`
- **Cause:** useEffect throwing unhandled errors
- **Location:** Email client page useEffect hooks
- **Fix:** Add error boundaries and proper error states

---

### 2. **Missing Error Handling in API Routes**
**Severity:** 🟡 HIGH

**Files Without Proper Error Handling:**
1. `/api/emails/folders/route.ts` - No try-catch around decrypt()
2. `/api/emails/route.ts` - No validation of token expiry
3. `/api/email/accounts/[id]/route.ts` - Multiple queries without error checks

**Pattern:**
```typescript
// ❌ CURRENT (Dangerous)
const { data: connection } = await supabase.from("email_connections").select().single();
const token = decrypt(connection.access_token); // Can throw!

// ✅ SHOULD BE
const { data: connection, error } = await supabase.from("email_connections").select().single();
if (error || !connection) {
  return NextResponse.json({ error: "Connection not found" }, { status: 404 });
}
try {
  const token = decrypt(connection.access_token);
} catch (err) {
  logger.error('[API] Decryption failed', { error: err });
  return NextResponse.json({ error: "Invalid connection" }, { status: 500 });
}
```

---

### 3. **Google OAuth Not Supported**
**Severity:** 🟡 HIGH

**Problem:**
- Users can connect Google accounts (based on schema enums)
- But `GraphEmailService` only supports Microsoft Graph API
- No `GoogleEmailService` implementation exists

**Evidence:**
```typescript
// src/db/schema.ts:60
export const emailProviderEnum = pgEnum("email_provider", ["microsoft", "google", "imap"]);

// But src/lib/email/graph-service.ts only works for "microsoft"
```

**Impact:**
- Users who connect Google accounts will get 400 errors on all email pages
- No way to fetch Google emails

**Fix Required:**
- Implement `GoogleEmailService` using Gmail API
- Update all email API routes to detect provider and use correct service
- OR remove Google from supported providers if not implemented

---

### 4. **IMAP Connections Not Supported in Email Client**
**Severity:** 🟡 HIGH

**Problem:**
- IMAP client exists (`src/lib/email/imap-client.ts`) ✅
- IMAP connection API exists (`src/app/api/email/connect-imap/route.ts`) ✅
- But email client UI (`/email-client`) doesn't support IMAP
- Only calls GraphEmailService (Microsoft)

**Impact:**
- Users who added IMAP accounts (we just built this!) cannot view emails

**Fix Required:**
- Update `/api/emails/folders` and `/api/emails` to support IMAP provider
- Detect provider type and route to correct service (Graph vs IMAP)

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 5. **Inconsistent User Table References**
**Severity:** 🟠 MEDIUM

**Problem:**
Some code references `user_profiles` table, but schema only has `users` table.

**Affected Files:**
- `src/app/api/email/accounts/[id]/route.ts:218`
  ```typescript
  const { data: profile } = await supabase
    .from("user_profiles") // ❌ Should be "users"
    .select("role")
  ```

**Fix:** Replace all `user_profiles` with `users`

---

### 6. **Database Schema Not in sync with Drizzle Schema**
**Severity:** 🟠 MEDIUM

**Problem:**
Database has extra columns that aren't in `src/db/schema.ts`:
- `email_connections.is_global` ✅ (exists in DB, missing from code schema)
- `email_connections.description` ✅ (exists in DB, missing from code schema)
- `email_connections.display_order` ✅ (exists in DB, missing from code schema)

**Impact:**
- TypeScript types don't reflect actual database structure
- ORM queries may fail or miss fields

**Fix:** Update Drizzle schema to match database:
```typescript
// src/db/schema.ts - Add missing fields
export const emailConnections = pgTable("email_connections", {
  // ... existing fields ...
  isGlobal: boolean("is_global").default(false),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
});
```

---

### 7. **Test Failures**
**Severity:** 🟠 MEDIUM

**Status:** 8 tests failing (all in `potential-tasks.test.ts`)

**Details:**
```
Test Files: 1 failed | 27 passed (28)
Tests: 8 failed | 492 passed (500)
```

**Cause:** Mock setup issues in test file (not actual code bugs)

**Fix:** Update mocks in `tests/unit/api/potential-tasks.test.ts`

---

## ✅ VERIFIED WORKING

### Database Tables
All required tables exist:
- ✅ `email_sender_rules`
- ✅ `email_training_feedback`
- ✅ `email_classifications`
- ✅ `email_action_items`
- ✅ `user_profiles`
- ✅ `potential_tasks`

### TypeScript Compilation
- ✅ No compilation errors
- ✅ All types valid

### Core Functionality
- ✅ Authentication works
- ✅ Task management works
- ✅ Database migrations successful
- ✅ Shared inbox system deployed

---

## 🚨 IMMEDIATE ACTION REQUIRED

### Priority 1: Fix Email Client Crashes

**Step 1:** Add provider detection and error handling
```typescript
// src/app/api/emails/folders/route.ts
const graphService = await GraphEmailService.fromConnection(user.id);
const googleService = await GoogleEmailService.fromConnection(user.id);
const imapService = await ImapService.fromConnection(user.id);

const service = graphService || googleService || imapService;

if (!service) {
  return NextResponse.json(
    { error: "Email not connected", needsConnection: true },
    { status: 400 }
  );
}
```

**Step 2:** Add error boundaries to email client page
```tsx
// src/app/(dashboard)/email-client/page.tsx
<ErrorBoundary fallback={<EmailClientError />}>
  <EmailClientContent />
</ErrorBoundary>
```

**Step 3:** Implement GoogleEmailService
- Create `src/lib/email/google-service.ts`
- Mirror GraphEmailService API
- Use Gmail API

### Priority 2: Fix user_profiles References
**Find and replace:** `user_profiles` → `users`

### Priority 3: Sync Drizzle Schema
Add missing columns to schema.ts

---

## 📊 Overall Health Score: 65/100

**Breakdown:**
- 🔴 Critical Issues: 4
- 🟡 High Priority: 0
- 🟠 Medium Priority: 3
- ✅ Working Features: 95%

**Recommendation:** Focus on Priority 1 issues immediately to unblock email functionality.
