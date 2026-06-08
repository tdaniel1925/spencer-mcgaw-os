# Microsoft OAuth Consent Issue - Fixed ✅

## Problem

Users were getting consent errors when trying to connect their Microsoft email accounts. The error occurred for some work/school accounts but not all personal accounts.

## Root Causes

1. **Forced Consent Every Time**: The OAuth flow used `prompt=consent`, which forced users to go through consent every single time, even if they'd already approved the app. This broke scenarios where:
   - Organizations had pre-approved the app (admin consent)
   - Conditional access policies restricted repeated consent prompts
   - Guest users didn't have permission to grant consent

2. **Poor Error Messages**: Generic error messages didn't explain what went wrong or how to fix it

3. **No Admin Consent Flow**: Organizations requiring IT approval had no way to complete the setup

## Solution

### 1. Changed Prompt Strategy
**Before:**
```typescript
authUrl.searchParams.set("prompt", "consent"); // ❌ Forces consent every time
```

**After:**
```typescript
authUrl.searchParams.set("prompt", adminConsent ? "admin_consent" : "select_account");
// ✅ Let Microsoft decide if consent is needed
```

**Why this works:**
- `select_account`: Allows users to pick their account. Microsoft automatically determines if consent is needed based on:
  - Whether they've already consented
  - Whether admin has pre-consented for the organization
  - Account security policies
- `admin_consent`: Special flow for IT admins to approve for entire organization (accessed via `?admin=true` query param)

### 2. Added Specific Error Messages

Now users get helpful guidance instead of generic errors:

| Error Code | User Message |
|------------|--------------|
| `admin_consent_required` | "Your organization requires admin approval. Please contact your IT administrator." |
| `access_denied` (user cancelled) | "You cancelled the sign-in process. Please try again." |
| `interaction_required` (MFA) | "Additional authentication required. Please ensure multi-factor authentication is set up." |
| `invalid_grant` | "The authorization code has expired. Please try connecting again." |
| `AADSTS65001` | "Your organization requires admin consent. Please ask your IT administrator to approve this app." |

### 3. Added Admin Consent Flow

Organizations can now approve the app for all users:
```
/api/email/connect?admin=true
```

This redirects to Microsoft's admin consent flow where IT administrators can approve permissions for the entire organization.

## How It Works Now

### Personal Microsoft Accounts (outlook.com, hotmail.com, etc.)
1. User clicks "Connect Email"
2. Redirected to Microsoft login
3. **First time**: Shows consent screen (one time only)
4. **Subsequent times**: No consent needed, direct sign-in
5. Stays connected via refresh token (`offline_access` scope)

### Work/School Accounts - User Has Permission
1. User clicks "Connect Email"
2. Redirected to Microsoft login
3. **First time**: Shows consent screen (one time only)
4. **Subsequent times**: No consent needed
5. Stays connected via refresh token

### Work/School Accounts - Admin Consent Required
1. User clicks "Connect Email"
2. Microsoft returns `admin_consent_required` error
3. User sees: "Your organization requires admin approval. Please contact your IT administrator."
4. **Admin approves**: Admin uses `?admin=true` link to approve for organization
5. **After approval**: All users can connect without individual consent

## Files Changed

### Backend
- `src/app/api/email/connect/route.ts` - Changed prompt, added admin consent flow
- `src/app/api/email/callback/route.ts` - Improved error handling with specific messages

### Tests
- `tests/unit/api/email/connect.test.ts` - Tests OAuth initiation flow
- `tests/unit/api/email/callback.test.ts` - Tests callback handling and error scenarios

## Testing

### Test Coverage: 12/12 Passing ✅

**Connect Route Tests:**
- ✅ Redirects to Microsoft OAuth with select_account prompt
- ✅ Uses admin_consent prompt when `?admin=true` is present
- ✅ Returns 500 if OAuth credentials not configured
- ✅ Includes all required scopes
- ✅ Uses custom redirect URI from env if provided

**Callback Route Tests:**
- ✅ Handles admin_consent_required error with helpful message
- ✅ Handles user cancelled consent gracefully
- ✅ Handles interaction_required (MFA) error
- ✅ Rejects invalid state (CSRF protection)
- ✅ Handles successful OAuth flow
- ✅ Handles invalid_grant with helpful message
- ✅ Handles AADSTS65001 (admin consent during token exchange)

### Run Tests
```bash
npm test tests/unit/api/email/connect.test.ts tests/unit/api/email/callback.test.ts
```

## User Experience Improvements

### Before
- ❌ Consent screen every single time
- ❌ Breaks work/school accounts with pre-consent
- ❌ Generic error messages
- ❌ No admin consent option
- ❌ Frustrating for users

### After
- ✅ Consent only once (or never if admin pre-approved)
- ✅ Works with organizational security policies
- ✅ Clear, actionable error messages
- ✅ Admin consent flow available
- ✅ Smooth user experience

## Refresh Token Flow (Stay Connected)

The app already had `offline_access` scope, which provides a refresh token. This means:

1. **User logs in once** → Gets access token + refresh token
2. **Access token expires** (after 1 hour) → Automatically refreshed using refresh token
3. **Refresh token expires** (after 90 days of inactivity) → User needs to log in again
4. **User stays active** → Never needs to re-authenticate

The refresh logic is handled automatically in `src/lib/email/graph-service.ts`:
```typescript
// Check if token is expired
if (new Date(connection.expires_at) <= new Date()) {
  if (!refreshToken) {
    throw new GraphServiceError("Token expired and no refresh token available");
  }
  // Refresh the token automatically
  const newTokens = await GraphEmailService.refreshAccessToken(refreshToken);
  // Update database with new tokens
}
```

## Security Considerations

- ✅ CSRF protection via state parameter
- ✅ Tokens encrypted at rest (AES-256-GCM)
- ✅ Secure cookies (httpOnly, sameSite)
- ✅ Token expiration handling
- ✅ Automatic token refresh

## Next Steps for Users

### If seeing admin consent error:
1. Contact your IT administrator
2. Provide them this link: `https://your-app.com/api/email/connect?admin=true`
3. Admin approves app for organization
4. All users can then connect without issues

### If still having issues:
1. Check that Microsoft app registration has correct redirect URI
2. Verify app has required permissions in Azure Portal
3. Ensure app is configured for correct account types (single-tenant vs multi-tenant)

## Deployment Notes

No environment variable changes needed. The fix works with existing configuration:
- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `MS_GRAPH_REDIRECT_URI` (optional)
