// Advanced Email Classification System for Tax/Accounting Firm
import { AIEmailClassification, EmailTaskCategory, EmailMessage } from "./types";

// Business context - what Bot Makers / Spencer McGaw does
export const BUSINESS_CONTEXT = {
  industry: "Tax & Accounting Services",
  services: [
    "tax preparation",
    "tax planning",
    "bookkeeping",
    "payroll",
    "business consulting",
    "IRS representation",
    "audit support",
    "financial statements",
    "quarterly estimates",
    "tax extensions",
  ],
  relevantTopics: [
    // Tax related
    "tax", "taxes", "irs", "1040", "1099", "w-2", "w2", "w-9", "w9",
    "schedule c", "schedule k", "k-1", "k1", "1065", "1120", "990",
    "tax return", "refund", "extension", "amendment", "audit",
    "deduction", "credit", "withholding", "estimated tax",
    // Accounting related
    "invoice", "payment", "billing", "account", "balance",
    "bookkeeping", "financial", "statement", "profit", "loss",
    "expense", "receipt", "payroll", "quarterly",
    // Client communication
    "appointment", "meeting", "call", "schedule", "consultation",
    "question", "help", "document", "file", "send", "upload",
    // Business related
    "client", "engagement", "service", "deadline", "due date",
  ],
};

// Spam/Marketing indicators - emails matching these should be rejected
const SPAM_MARKETING_INDICATORS = {
  // Common spam/marketing sender patterns
  senderPatterns: [
    /noreply@/i,
    /no-reply@/i,
    /donotreply@/i,
    /newsletter@/i,
    /marketing@/i,
    /promo@/i,
    /offers@/i,
    /deals@/i,
    /info@.*\.com$/i,  // Generic info@ addresses
    /hello@.*\.com$/i, // Generic hello@ addresses (often marketing)
    /support@(?!spencermcgaw|botmakers)/i, // Support emails not from our domains
  ],
  // Subject line patterns indicating spam/marketing
  subjectPatterns: [
    /unsubscribe/i,
    /\bsale\b/i,
    /\boff\b.*%/i, // "50% off", "20% off"
    /limited time/i,
    /act now/i,
    /don't miss/i,
    /exclusive offer/i,
    /free trial/i,
    /special offer/i,
    /newsletter/i,
    /weekly digest/i,
    /daily digest/i,
    /monthly update/i,
    /\bpromo\b/i,
    /discount/i,
    /coupon/i,
    /deal of/i,
    /flash sale/i,
    /black friday/i,
    /cyber monday/i,
    /holiday sale/i,
  ],
  // Body content patterns
  bodyPatterns: [
    /unsubscribe/i,
    /opt.?out/i,
    /email preferences/i,
    /manage.*subscription/i,
    /you.*subscribed/i,
    /receiving this.*email/i,
    /view.*browser/i,
    /view this email online/i,
    /trouble viewing/i,
    /add us to your contacts/i,
    /privacy policy/i,
    /terms.*conditions/i,
  ],
  // Known marketing/newsletter domains
  marketingDomains: [
    "mailchimp.com",
    "sendgrid.net",
    "constantcontact.com",
    "hubspot.com",
    "marketo.com",
    "salesforce.com",
    "mailgun.org",
    "sendpulse.com",
    "klaviyo.com",
    "drip.com",
    "convertkit.com",
    "aweber.com",
    "getresponse.com",
    "activecampaign.com",
    "campaignmonitor.com",
    "sendinblue.com",
    "linkedin.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
  ],
};

// Newsletter indicators
const NEWSLETTER_INDICATORS = {
  subjectPatterns: [
    /newsletter/i,
    /digest/i,
    /weekly.*update/i,
    /monthly.*update/i,
    /roundup/i,
    /this week in/i,
    /weekly wrap/i,
    /edition/i,
    /issue #?\d+/i,
  ],
  bodyPatterns: [
    /this week's/i,
    /this month's/i,
    /top stories/i,
    /featured articles/i,
    /read more/i,
    /continue reading/i,
  ],
};

// Notification indicators (system notifications, not client emails)
const NOTIFICATION_INDICATORS = {
  senderPatterns: [
    /notifications?@/i,
    /alerts?@/i,
    /updates?@/i,
    /system@/i,
    /automated@/i,
  ],
  subjectPatterns: [
    /notification/i,
    /alert:/i,
    /reminder:/i,
    /automated/i,
    /your.*order/i,
    /shipping.*confirmation/i,
    /delivery.*update/i,
    /password.*reset/i,
    /verify.*email/i,
    /confirm.*email/i,
    /security.*alert/i,
    /login.*detected/i,
    /new.*device/i,
  ],
};

export type EmailRelevance = "relevant" | "spam" | "marketing" | "newsletter" | "notification" | "unknown";

export interface EmailClassificationResult {
  relevance: EmailRelevance;
  isBusinessRelevant: boolean;
  confidence: number;
  reasons: string[];
  classification: AIEmailClassification;
}

// Check if email is from a marketing domain
function isMarketingDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return SPAM_MARKETING_INDICATORS.marketingDomains.some(d => domain.includes(d));
}

// Check if email matches spam/marketing patterns
function checkSpamMarketing(email: Partial<EmailMessage>): { isSpam: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const fromEmail = email.from?.email?.toLowerCase() || "";
  const subject = email.subject?.toLowerCase() || "";
  const body = (email.bodyPreview || email.body || "").toLowerCase();

  // Check sender patterns
  for (const pattern of SPAM_MARKETING_INDICATORS.senderPatterns) {
    if (pattern.test(fromEmail)) {
      reasons.push(`Sender matches marketing pattern: ${fromEmail}`);
    }
  }

  // Check if from marketing domain
  if (isMarketingDomain(fromEmail)) {
    reasons.push(`Email from known marketing domain`);
  }

  // Check subject patterns
  for (const pattern of SPAM_MARKETING_INDICATORS.subjectPatterns) {
    if (pattern.test(subject)) {
      reasons.push(`Subject contains marketing indicator`);
      break;
    }
  }

  // Check body patterns
  let marketingBodyMatches = 0;
  for (const pattern of SPAM_MARKETING_INDICATORS.bodyPatterns) {
    if (pattern.test(body)) {
      marketingBodyMatches++;
    }
  }
  if (marketingBodyMatches >= 2) {
    reasons.push(`Body contains ${marketingBodyMatches} marketing indicators`);
  }

  return { isSpam: reasons.length >= 2, reasons };
}

// Check if email is a newsletter
function checkNewsletter(email: Partial<EmailMessage>): { isNewsletter: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const subject = email.subject?.toLowerCase() || "";
  const body = (email.bodyPreview || email.body || "").toLowerCase();

  for (const pattern of NEWSLETTER_INDICATORS.subjectPatterns) {
    if (pattern.test(subject)) {
      reasons.push(`Subject indicates newsletter`);
      break;
    }
  }

  let bodyMatches = 0;
  for (const pattern of NEWSLETTER_INDICATORS.bodyPatterns) {
    if (pattern.test(body)) {
      bodyMatches++;
    }
  }
  if (bodyMatches >= 2) {
    reasons.push(`Body contains newsletter patterns`);
  }

  return { isNewsletter: reasons.length >= 1, reasons };
}

// Check if email is a system notification
function checkNotification(email: Partial<EmailMessage>): { isNotification: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const fromEmail = email.from?.email?.toLowerCase() || "";
  const subject = email.subject?.toLowerCase() || "";

  for (const pattern of NOTIFICATION_INDICATORS.senderPatterns) {
    if (pattern.test(fromEmail)) {
      reasons.push(`Sender is automated notification`);
      break;
    }
  }

  for (const pattern of NOTIFICATION_INDICATORS.subjectPatterns) {
    if (pattern.test(subject)) {
      reasons.push(`Subject indicates system notification`);
      break;
    }
  }

  return { isNotification: reasons.length >= 1, reasons };
}

// Check if email is business relevant (tax/accounting related)
function checkBusinessRelevance(email: Partial<EmailMessage>): { isRelevant: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  const subject = email.subject?.toLowerCase() || "";
  const body = (email.bodyPreview || email.body || "").toLowerCase();
  const fromEmail = email.from?.email?.toLowerCase() || "";
  const combined = subject + " " + body;

  let relevanceScore = 0;
  const matchedTopics: string[] = [];

  // Check for relevant business topics
  for (const topic of BUSINESS_CONTEXT.relevantTopics) {
    if (combined.includes(topic)) {
      relevanceScore += 10;
      matchedTopics.push(topic);
    }
  }

  // Check for service-related keywords
  for (const service of BUSINESS_CONTEXT.services) {
    if (combined.includes(service)) {
      relevanceScore += 15;
      matchedTopics.push(service);
    }
  }

  // Personal email indicators (likely a real person/client)
  const personalEmailPatterns = [
    /@gmail\.com$/i,
    /@yahoo\.com$/i,
    /@outlook\.com$/i,
    /@hotmail\.com$/i,
    /@icloud\.com$/i,
    /@aol\.com$/i,
  ];

  const isPersonalEmail = personalEmailPatterns.some(p => p.test(fromEmail));
  if (isPersonalEmail && !isMarketingDomain(fromEmail)) {
    relevanceScore += 20;
    reasons.push("From personal email address (likely client)");
  }

  // Check if it's a reply or forward (indicates ongoing conversation)
  if (/^(re:|fwd:|fw:)/i.test(email.subject || "")) {
    relevanceScore += 15;
    reasons.push("Part of ongoing conversation");
  }

  // Check for question indicators (client asking something)
  if (/\?/.test(combined) || /can you|could you|please|help|need/i.test(combined)) {
    relevanceScore += 10;
    reasons.push("Contains question or request");
  }

  if (matchedTopics.length > 0) {
    reasons.push(`Matches business topics: ${matchedTopics.slice(0, 3).join(", ")}`);
  }

  // Normalize score to confidence (0-1)
  const confidence = Math.min(relevanceScore / 100, 1);

  return {
    isRelevant: relevanceScore >= 25,
    confidence,
    reasons,
  };
}

// Determine the business category for relevant emails
function determineCategory(email: Partial<EmailMessage>): EmailTaskCategory {
  const subject = email.subject?.toLowerCase() || "";
  const body = (email.bodyPreview || email.body || "").toLowerCase();
  const combined = subject + " " + body;

  // Priority-based category detection
  if (/urgent|asap|immediately|emergency/i.test(combined)) {
    return "urgent";
  }

  if (/document|w-?2|1099|tax return|upload|attach|send.*file/i.test(combined)) {
    return "document_request";
  }

  if (/\?|question|wondering|can you|could you|how do|what is/i.test(combined)) {
    return "question";
  }

  if (/payment|invoice|bill|pay|amount|balance due|owe/i.test(combined)) {
    return "payment";
  }

  if (/appointment|schedule|meeting|call|available|calendar/i.test(combined)) {
    return "appointment";
  }

  if (/tax.*return|filing|irs|1040|extension|amendment/i.test(combined)) {
    return "tax_filing";
  }

  if (/deadline|compliance|regulation|due date|required/i.test(combined)) {
    return "compliance";
  }

  if (/follow.?up|following up|checking in|status|update/i.test(combined)) {
    return "follow_up";
  }

  if (/fyi|for your information|just letting|heads up/i.test(combined)) {
    return "information";
  }

  return "other";
}

// Main classification function
export function classifyEmail(email: Partial<EmailMessage>): EmailClassificationResult {
  const reasons: string[] = [];

  // Step 1: Check for spam/marketing
  const spamCheck = checkSpamMarketing(email);
  if (spamCheck.isSpam) {
    return {
      relevance: "spam",
      isBusinessRelevant: false,
      confidence: 0.85,
      reasons: spamCheck.reasons,
      classification: createRejectedClassification("spam", spamCheck.reasons),
    };
  }

  // Step 2: Check for newsletters
  const newsletterCheck = checkNewsletter(email);
  if (newsletterCheck.isNewsletter) {
    return {
      relevance: "newsletter",
      isBusinessRelevant: false,
      confidence: 0.8,
      reasons: newsletterCheck.reasons,
      classification: createRejectedClassification("spam", newsletterCheck.reasons),
    };
  }

  // Step 3: Check for system notifications
  const notificationCheck = checkNotification(email);
  if (notificationCheck.isNotification) {
    return {
      relevance: "notification",
      isBusinessRelevant: false,
      confidence: 0.75,
      reasons: notificationCheck.reasons,
      classification: createRejectedClassification("spam", notificationCheck.reasons),
    };
  }

  // Step 4: Check business relevance
  const businessCheck = checkBusinessRelevance(email);
  reasons.push(...businessCheck.reasons);

  if (!businessCheck.isRelevant) {
    return {
      relevance: "unknown",
      isBusinessRelevant: false,
      confidence: 1 - businessCheck.confidence,
      reasons: ["Email does not appear to be business-related", ...reasons],
      classification: createRejectedClassification("other", ["Not business relevant"]),
    };
  }

  // Step 5: Classify the relevant email
  const category = determineCategory(email);

  return {
    relevance: "relevant",
    isBusinessRelevant: true,
    confidence: businessCheck.confidence,
    reasons,
    classification: createBusinessClassification(email, category, businessCheck.confidence),
  };
}

// Create classification for rejected emails
function createRejectedClassification(category: EmailTaskCategory, reasons: string[]): AIEmailClassification {
  return {
    category,
    priority: "low",
    confidence: 0.9,
    suggestedAction: "archive",
    summary: reasons[0] || "Email filtered as non-business related",
    keyPoints: reasons,
    sentiment: "neutral",
    topics: [],
    requiresResponse: false,
    responseUrgency: "whenever",
    classifiedAt: new Date(),
  };
}

// Create classification for business-relevant emails
function createBusinessClassification(
  email: Partial<EmailMessage>,
  category: EmailTaskCategory,
  confidence: number
): AIEmailClassification {
  const subject = email.subject?.toLowerCase() || "";
  const body = email.bodyPreview?.toLowerCase() || "";
  const combined = subject + " " + body;

  // Determine priority
  let priority: "low" | "medium" | "high" | "urgent" = "medium";
  if (/urgent|asap|immediately|emergency/i.test(combined)) {
    priority = "urgent";
  } else if (/important|deadline|due|required|irs/i.test(combined)) {
    priority = "high";
  } else if (/fyi|just letting|no rush|when you can/i.test(combined)) {
    priority = "low";
  }

  // Determine suggested action
  let suggestedAction: AIEmailClassification["suggestedAction"] = "respond_today";
  switch (category) {
    case "urgent":
      suggestedAction = "respond_immediately";
      break;
    case "document_request":
      suggestedAction = "request_documents";
      break;
    case "appointment":
      suggestedAction = "schedule_call";
      break;
    case "tax_filing":
    case "compliance":
      suggestedAction = "create_task";
      break;
    case "information":
      suggestedAction = "archive";
      break;
  }

  // Generate summary based on category
  const summaries: Record<EmailTaskCategory, string> = {
    document_request: "Client document request - review and respond",
    question: "Client question requiring response",
    payment: "Payment or billing inquiry",
    appointment: "Scheduling or meeting request",
    tax_filing: "Tax filing or IRS related matter",
    compliance: "Compliance deadline or requirement",
    follow_up: "Follow-up on previous communication",
    information: "Informational message",
    urgent: "Urgent matter requiring immediate attention",
    spam: "Filtered as non-business email",
    internal: "Internal team communication",
    other: "General client inquiry",
  };

  // Determine sentiment
  let sentiment: "positive" | "neutral" | "negative" = "neutral";
  if (/thank|appreciate|great|excellent|happy|pleased/i.test(combined)) {
    sentiment = "positive";
  } else if (/frustrated|unhappy|disappointed|angry|upset|problem|issue/i.test(combined)) {
    sentiment = "negative";
  }

  // Check if response is required
  const requiresResponse = category !== "information" && category !== "spam";

  return {
    category,
    priority,
    confidence,
    suggestedAction,
    summary: summaries[category],
    keyPoints: [
      `Category: ${category.replace("_", " ")}`,
      `Priority: ${priority}`,
      requiresResponse ? "Requires response" : "No response needed",
    ],
    sentiment,
    topics: [category.replace("_", " ")],
    requiresResponse,
    responseUrgency: priority === "urgent" ? "immediate" : priority === "high" ? "today" : "this_week",
    classifiedAt: new Date(),
  };
}
