/**
 * Client Matching Service
 *
 * Matches email senders to existing clients in the database using:
 * - Exact email match
 * - Domain matching
 * - Name similarity matching
 * - Phone number matching
 */

import { createClient } from "@/lib/supabase/server";

export interface ClientMatch {
  clientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  matchType: "exact_email" | "domain" | "name_match" | "phone_match" | "company_match";
  confidence: number;
  matchReason: string;
}

export interface ClientMatchResult {
  primaryMatch?: ClientMatch;
  alternativeMatches: ClientMatch[];
  searchTermsUsed: string[];
}

/**
 * Normalize email for comparison
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string {
  const parts = email.split("@");
  return parts[1]?.toLowerCase() || "";
}

/**
 * Normalize name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Simple contains check
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
}

/**
 * Match an email sender to clients in the database
 */
export async function matchEmailToClient(
  senderEmail: string,
  senderName?: string,
  extractedNames?: string[],
  extractedPhones?: string[],
  extractedCompanies?: string[]
): Promise<ClientMatchResult> {
  const supabase = await createClient();
  const matches: ClientMatch[] = [];
  const searchTermsUsed: string[] = [];

  const normalizedEmail = normalizeEmail(senderEmail);
  const senderDomain = extractDomain(senderEmail);

  // Skip common email providers for domain matching
  const genericDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
    "live.com",
    "msn.com",
  ];
  const isGenericDomain = genericDomains.includes(senderDomain);

  // 1. Exact email match
  searchTermsUsed.push(`email:${normalizedEmail}`);
  const { data: emailMatches } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone, company_name")
    .ilike("email", normalizedEmail)
    .limit(5);

  if (emailMatches && emailMatches.length > 0) {
    for (const client of emailMatches) {
      matches.push({
        clientId: client.id,
        firstName: client.first_name,
        lastName: client.last_name,
        email: client.email,
        phone: client.phone,
        companyName: client.company_name,
        matchType: "exact_email",
        confidence: 1.0,
        matchReason: "Email address matches exactly",
      });
    }
  }

  // 2. Domain match (for business emails only)
  if (!isGenericDomain && matches.length === 0) {
    searchTermsUsed.push(`domain:${senderDomain}`);
    const { data: domainMatches } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, company_name")
      .ilike("email", `%@${senderDomain}`)
      .limit(10);

    if (domainMatches && domainMatches.length > 0) {
      for (const client of domainMatches) {
        matches.push({
          clientId: client.id,
          firstName: client.first_name,
          lastName: client.last_name,
          email: client.email,
          phone: client.phone,
          companyName: client.company_name,
          matchType: "domain",
          confidence: 0.7,
          matchReason: `Same email domain: ${senderDomain}`,
        });
      }
    }
  }

  // 3. Name matching
  const namesToSearch = [
    senderName,
    ...(extractedNames || []),
  ].filter(Boolean) as string[];

  for (const name of namesToSearch) {
    searchTermsUsed.push(`name:${name}`);
    const normalizedName = normalizeName(name);
    const nameParts = normalizedName.split(/\s+/);

    if (nameParts.length >= 1) {
      // Try first name + last name search
      const { data: nameMatches } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, company_name")
        .or(
          nameParts
            .map(
              (part) =>
                `first_name.ilike.%${part}%,last_name.ilike.%${part}%`
            )
            .join(",")
        )
        .limit(10);

      if (nameMatches) {
        for (const client of nameMatches) {
          const clientFullName = `${client.first_name} ${client.last_name}`;
          const similarity = calculateSimilarity(name, clientFullName);

          if (similarity >= 0.6) {
            // Only add if not already matched
            if (!matches.find((m) => m.clientId === client.id)) {
              matches.push({
                clientId: client.id,
                firstName: client.first_name,
                lastName: client.last_name,
                email: client.email,
                phone: client.phone,
                companyName: client.company_name,
                matchType: "name_match",
                confidence: similarity * 0.8,
                matchReason: `Name similarity: "${name}" matches "${clientFullName}"`,
              });
            }
          }
        }
      }
    }
  }

  // 4. Phone matching
  if (extractedPhones && extractedPhones.length > 0) {
    for (const phone of extractedPhones) {
      // Normalize phone number (remove non-digits)
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length >= 10) {
        searchTermsUsed.push(`phone:${phone}`);

        // Search for last 10 digits
        const last10 = normalizedPhone.slice(-10);
        const { data: phoneMatches } = await supabase
          .from("clients")
          .select("id, first_name, last_name, email, phone, company_name")
          .or(`phone.ilike.%${last10}%,alternate_phone.ilike.%${last10}%`)
          .limit(5);

        if (phoneMatches) {
          for (const client of phoneMatches) {
            if (!matches.find((m) => m.clientId === client.id)) {
              matches.push({
                clientId: client.id,
                firstName: client.first_name,
                lastName: client.last_name,
                email: client.email,
                phone: client.phone,
                companyName: client.company_name,
                matchType: "phone_match",
                confidence: 0.85,
                matchReason: `Phone number matches: ${phone}`,
              });
            }
          }
        }
      }
    }
  }

  // 5. Company name matching
  if (extractedCompanies && extractedCompanies.length > 0) {
    for (const company of extractedCompanies) {
      searchTermsUsed.push(`company:${company}`);

      const { data: companyMatches } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, company_name")
        .ilike("company_name", `%${company}%`)
        .limit(5);

      if (companyMatches) {
        for (const client of companyMatches) {
          if (!matches.find((m) => m.clientId === client.id)) {
            matches.push({
              clientId: client.id,
              firstName: client.first_name,
              lastName: client.last_name,
              email: client.email,
              phone: client.phone,
              companyName: client.company_name,
              matchType: "company_match",
              confidence: 0.75,
              matchReason: `Company name matches: ${company}`,
            });
          }
        }
      }
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    primaryMatch: matches[0],
    alternativeMatches: matches.slice(1, 5), // Top 4 alternatives
    searchTermsUsed,
  };
}

/**
 * Save client match to database
 */
export async function saveClientMatch(
  emailMessageId: string,
  senderEmail: string,
  match: ClientMatch | null,
  alternativeClientIds?: string[]
): Promise<void> {
  const supabase = await createClient();

  await supabase.from("email_client_matches").upsert(
    {
      email_message_id: emailMessageId,
      sender_email: senderEmail.toLowerCase(),
      matched_client_id: match?.clientId || null,
      match_type: match?.matchType || "manual",
      match_confidence: match?.confidence || 0,
      match_reason: match?.matchReason || null,
      alternative_client_ids: alternativeClientIds || [],
      is_verified: false,
    },
    {
      onConflict: "email_message_id",
    }
  );
}

/**
 * Verify a client match (user confirms or corrects)
 */
export async function verifyClientMatch(
  emailMessageId: string,
  clientId: string | null,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("email_client_matches")
    .update({
      matched_client_id: clientId,
      is_verified: true,
      verified_by: userId,
      verified_at: new Date().toISOString(),
      match_type: "manual",
      match_confidence: 1.0,
      match_reason: "Manually verified by user",
    })
    .eq("email_message_id", emailMessageId);
}
