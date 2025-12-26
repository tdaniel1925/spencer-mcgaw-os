/**
 * Twilio Lookup API Service
 *
 * Enriches phone numbers with caller name and type information
 * using Twilio's Lookup v2 API.
 *
 * Pricing: ~$0.01 per lookup (US numbers only)
 * Non-US numbers return null but are not charged.
 */

import Twilio from "twilio";
import logger from "@/lib/logger";

// Simple in-memory cache to avoid repeated lookups
// Key: normalized phone number, Value: { name, type, timestamp }
const lookupCache = new Map<string, {
  callerName: string | null;
  callerType: "BUSINESS" | "CONSUMER" | null;
  timestamp: number;
}>();

// Cache TTL: 24 hours (caller name data doesn't change often)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Max cache size to prevent memory issues
const MAX_CACHE_SIZE = 10000;

export interface CallerLookupResult {
  callerName: string | null;
  callerType: "BUSINESS" | "CONSUMER" | null;
  phoneNumber: string;
  countryCode: string | null;
  carrier: string | null;
  lineType: string | null;
  fromCache: boolean;
  error?: string;
}

/**
 * Check if Twilio Lookup is configured
 */
export function isTwilioLookupAvailable(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}

/**
 * Normalize a phone number to E.164 format for caching
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // If no country code, assume US (+1)
  if (!cleaned.startsWith("+")) {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
  }

  return cleaned;
}

/**
 * Check if a phone number is a US number (Twilio Caller Name only works for US)
 */
function isUSPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return normalized.startsWith("+1") && normalized.length === 12;
}

/**
 * Get cached lookup result if available and not expired
 */
function getCachedLookup(phone: string): CallerLookupResult | null {
  const normalized = normalizePhoneNumber(phone);
  const cached = lookupCache.get(normalized);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      callerName: cached.callerName,
      callerType: cached.callerType,
      phoneNumber: normalized,
      countryCode: normalized.startsWith("+1") ? "US" : null,
      carrier: null,
      lineType: null,
      fromCache: true,
    };
  }

  return null;
}

/**
 * Store lookup result in cache
 */
function cacheLookup(
  phone: string,
  callerName: string | null,
  callerType: "BUSINESS" | "CONSUMER" | null
): void {
  const normalized = normalizePhoneNumber(phone);

  // Evict oldest entries if cache is full
  if (lookupCache.size >= MAX_CACHE_SIZE) {
    const firstKey = lookupCache.keys().next().value;
    if (firstKey) {
      lookupCache.delete(firstKey);
    }
  }

  lookupCache.set(normalized, {
    callerName,
    callerType,
    timestamp: Date.now(),
  });
}

/**
 * Look up caller name using Twilio Lookup v2 API
 *
 * @param phoneNumber - Phone number to look up (any format)
 * @returns Caller information including name and type
 */
export async function lookupCallerName(
  phoneNumber: string
): Promise<CallerLookupResult> {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Check cache first
  const cached = getCachedLookup(phoneNumber);
  if (cached) {
    return cached;
  }

  // Check if Twilio is configured
  if (!isTwilioLookupAvailable()) {
    return {
      callerName: null,
      callerType: null,
      phoneNumber: normalized,
      countryCode: null,
      carrier: null,
      lineType: null,
      fromCache: false,
      error: "Twilio not configured",
    };
  }

  // Non-US numbers won't have caller name data but we still do the lookup for line type info

  try {
    const client = Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    // Fetch with caller_name and line_type_intelligence fields
    const result = await client.lookups.v2
      .phoneNumbers(normalized)
      .fetch({ fields: "caller_name,line_type_intelligence" });

    // Extract caller name info
    const callerNameData = result.callerName as {
      caller_name?: string | null;
      caller_type?: "BUSINESS" | "CONSUMER" | null;
      error_code?: string | null;
    } | null;

    // Extract line type info
    const lineTypeData = result.lineTypeIntelligence as {
      carrier_name?: string | null;
      type?: string | null;
      error_code?: string | null;
    } | null;

    const callerName = callerNameData?.caller_name || null;
    const callerType = callerNameData?.caller_type || null;
    const carrier = lineTypeData?.carrier_name || null;
    const lineType = lineTypeData?.type || null;

    // Cache the result
    cacheLookup(normalized, callerName, callerType);

    return {
      callerName,
      callerType,
      phoneNumber: normalized,
      countryCode: result.countryCode || null,
      carrier,
      lineType,
      fromCache: false,
    };
  } catch (error) {
    logger.error(`[Twilio Lookup] Error looking up ${normalized}`, error);

    // Cache null result to avoid repeated failed lookups
    cacheLookup(normalized, null, null);

    return {
      callerName: null,
      callerType: null,
      phoneNumber: normalized,
      countryCode: null,
      carrier: null,
      lineType: null,
      fromCache: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Enrich a caller with name lookup if name is missing
 *
 * Use this when you have a phone number but no name (or just a phone number as name)
 *
 * @param phone - Caller phone number
 * @param existingName - Existing caller name (if any)
 * @returns Enriched caller name or original/phone number
 */
export async function enrichCallerName(
  phone: string | null,
  existingName: string | null
): Promise<{
  name: string | null;
  type: "BUSINESS" | "CONSUMER" | null;
  enriched: boolean;
  source: "existing" | "twilio" | "phone" | "unknown";
}> {
  // If we already have a good name (not just a phone number), use it
  if (existingName && !isPhoneNumberLikeName(existingName)) {
    return {
      name: existingName,
      type: null,
      enriched: false,
      source: "existing",
    };
  }

  // If no phone number, can't do lookup
  if (!phone) {
    return {
      name: existingName,
      type: null,
      enriched: false,
      source: existingName ? "existing" : "unknown",
    };
  }

  // Try Twilio lookup
  const lookup = await lookupCallerName(phone);

  if (lookup.callerName) {
    return {
      name: lookup.callerName,
      type: lookup.callerType,
      enriched: true,
      source: "twilio",
    };
  }

  // Fall back to phone number or existing name
  return {
    name: existingName || formatPhoneForDisplay(phone),
    type: null,
    enriched: false,
    source: existingName ? "existing" : "phone",
  };
}

/**
 * Check if a "name" is actually just a phone number
 */
function isPhoneNumberLikeName(name: string): boolean {
  // Remove common formatting
  const cleaned = name.replace(/[\s\-\(\)\.]/g, "");
  // If it's mostly digits (>60%), it's probably a phone number
  const digitCount = (cleaned.match(/\d/g) || []).length;
  return digitCount / cleaned.length > 0.6;
}

/**
 * Format a phone number for display when no name is available
 */
function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  // Format US numbers nicely
  if (normalized.startsWith("+1") && normalized.length === 12) {
    const digits = normalized.slice(2);
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return normalized;
}

/**
 * Clear the lookup cache (useful for testing)
 */
export function clearLookupCache(): void {
  lookupCache.clear();
}

/**
 * Get cache statistics
 */
export function getLookupCacheStats(): {
  size: number;
  maxSize: number;
  ttlMs: number;
} {
  return {
    size: lookupCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}
