import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/my-inbox/debug
 * Debug endpoint to see what's in the database
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // 1. Get ALL email connections for this user
    const { data: allConnections } = await supabase
      .from("email_connections")
      .select("id, email, provider, is_global, created_at")
      .eq("user_id", user.id);

    // 2. Get ALL email classifications (regardless of account)
    const { data: allClassifications, count: totalClassifications } = await supabase
      .from("email_classifications")
      .select("id, account_id, subject, sender_email, received_at, category", { count: "exact" })
      .order("received_at", { ascending: false })
      .limit(50);

    // 3. Get classifications grouped by account_id
    const classificationsByAccount: Record<string, number> = {};
    if (allClassifications) {
      for (const c of allClassifications) {
        classificationsByAccount[c.account_id] = (classificationsByAccount[c.account_id] || 0) + 1;
      }
    }

    // 4. Check which account_ids match user's connections
    const userAccountIds = new Set(allConnections?.map(c => c.id) || []);
    const matchingClassifications = allClassifications?.filter(c => userAccountIds.has(c.account_id)) || [];

    // 5. Check personal (non-global) accounts specifically
    const personalAccounts = allConnections?.filter(c => !c.is_global) || [];
    const personalAccountIds = new Set(personalAccounts.map(c => c.id));
    const personalClassifications = allClassifications?.filter(c => personalAccountIds.has(c.account_id)) || [];

    return NextResponse.json({
      user_id: user.id,

      connections: {
        total: allConnections?.length || 0,
        accounts: allConnections?.map(c => ({
          id: c.id,
          email: c.email,
          provider: c.provider,
          is_global: c.is_global,
        })),
        personal_count: personalAccounts.length,
        global_count: (allConnections?.length || 0) - personalAccounts.length,
      },

      classifications: {
        total_in_db: totalClassifications,
        by_account_id: classificationsByAccount,
        matching_user_accounts: matchingClassifications.length,
        matching_personal_accounts: personalClassifications.length,
        sample_emails: allClassifications?.slice(0, 10).map(c => ({
          id: c.id,
          account_id: c.account_id,
          account_matches_user: userAccountIds.has(c.account_id),
          account_is_personal: personalAccountIds.has(c.account_id),
          subject: c.subject?.substring(0, 50),
          from: c.sender_email,
          received: c.received_at,
        })),
      },

      diagnosis: {
        issue: personalClassifications.length === 0
          ? "No emails linked to personal accounts"
          : personalClassifications.length < (matchingClassifications.length || 0)
          ? "Some emails are linked to global accounts (showing in Org Feed instead)"
          : "Emails should be showing",
        recommendation: personalAccounts.length === 0
          ? "Change your email account from 'Organization' to 'Personal' in Account Settings"
          : personalClassifications.length === 0
          ? "Emails may be linked to wrong account_id, or account is set to global"
          : "Check the my-inbox API for other filtering issues",
      },
    });
  } catch (error) {
    console.error("[Debug API] Error:", error);
    return NextResponse.json({ error: "Debug failed", details: String(error) }, { status: 500 });
  }
}
