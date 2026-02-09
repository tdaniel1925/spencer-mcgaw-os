/**
 * Smart Routing Engine for Email-to-Task Assignment
 *
 * Automatically assigns tasks based on:
 * - Email category and content
 * - Extracted amounts and urgency
 * - Client relationships
 * - Team member workload and expertise
 */

interface EmailData {
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  extractedAmounts?: { value: number }[];
  requiresResponse?: boolean;
  matchedClientId?: string | null;
  sentiment?: string;
  extractedDocumentTypes?: string[];
}

interface ClientData {
  assigned_user_id?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  role?: string;
  openTaskCount?: number;
}

interface RoutingResult {
  assignedTo: string | null;
  reason: string;
  confidence: number; // 0-1
  routingRule: string;
}

/**
 * Smart Routing Rules Configuration
 */
export const ROUTING_RULES = {
  // Priority 1: Client relationship (highest priority)
  CLIENT_RELATIONSHIP: {
    priority: 1,
    description: "Assign to client's primary accountant",
    confidence: 0.95,
  },

  // Priority 2: Category-based routing
  TAX_FILING: {
    priority: 2,
    category: "tax_filing",
    requiredRole: "tax_preparer",
    description: "Tax filings go to tax preparers",
    confidence: 0.90,
  },

  COMPLIANCE: {
    priority: 2,
    category: "compliance",
    requiredRole: "compliance_specialist",
    description: "Compliance matters go to specialists",
    confidence: 0.90,
  },

  DOCUMENT_REQUEST: {
    priority: 2,
    category: "document_request",
    preferredRole: "staff",
    description: "Document requests can go to staff",
    confidence: 0.80,
  },

  PAYMENT: {
    priority: 2,
    category: "payment",
    requiredRole: "billing_specialist",
    description: "Payment matters go to billing",
    confidence: 0.85,
  },

  APPOINTMENT: {
    priority: 2,
    category: "appointment",
    preferredRole: "admin",
    description: "Appointments handled by admin/staff",
    confidence: 0.75,
  },

  // Priority 3: Amount-based routing
  HIGH_VALUE: {
    priority: 3,
    minAmount: 10000,
    requiredRole: "senior_accountant",
    description: "High-value matters go to senior staff",
    confidence: 0.85,
  },

  MEDIUM_VALUE: {
    priority: 3,
    minAmount: 5000,
    maxAmount: 10000,
    preferredRole: "accountant",
    description: "Medium-value matters go to accountants",
    confidence: 0.75,
  },

  // Priority 4: Urgency-based routing
  URGENT: {
    priority: 4,
    urgency: "urgent",
    description: "Urgent matters go to least busy team member",
    confidence: 0.70,
  },

  // Priority 5: Load balancing (fallback)
  LOAD_BALANCE: {
    priority: 5,
    description: "Distribute work evenly across team",
    confidence: 0.50,
  },
};

/**
 * Determine task assignment using smart routing rules
 */
export async function determineSmartAssignment(
  emailData: EmailData,
  clientData: ClientData | null,
  teamMembers: TeamMember[]
): Promise<RoutingResult> {
  // Rule 1: Client Relationship (highest priority)
  if (clientData?.assigned_user_id) {
    return {
      assignedTo: clientData.assigned_user_id,
      reason: "Client's primary accountant (maintains continuity)",
      confidence: ROUTING_RULES.CLIENT_RELATIONSHIP.confidence,
      routingRule: "CLIENT_RELATIONSHIP",
    };
  }

  // Rule 2: Category-based routing
  const categoryResult = routeByCategory(emailData, teamMembers);
  if (categoryResult) {
    return categoryResult;
  }

  // Rule 3: Amount-based routing
  const amountResult = routeByAmount(emailData, teamMembers);
  if (amountResult) {
    return amountResult;
  }

  // Rule 4: Urgency-based routing
  if (emailData.priority === "urgent") {
    const leastBusyMember = findLeastBusyMember(teamMembers);
    if (leastBusyMember) {
      return {
        assignedTo: leastBusyMember.id,
        reason: `Urgent - assigned to least busy team member (${leastBusyMember.openTaskCount || 0} open tasks)`,
        confidence: ROUTING_RULES.URGENT.confidence,
        routingRule: "URGENT",
      };
    }
  }

  // Rule 5: Load balancing (fallback)
  const loadBalancedMember = findLeastBusyMember(teamMembers);
  if (loadBalancedMember) {
    return {
      assignedTo: loadBalancedMember.id,
      reason: `Load balanced - assigned to team member with lightest workload (${loadBalancedMember.openTaskCount || 0} open tasks)`,
      confidence: ROUTING_RULES.LOAD_BALANCE.confidence,
      routingRule: "LOAD_BALANCE",
    };
  }

  // No assignment possible
  return {
    assignedTo: null,
    reason: "No suitable team member found - will go to general task pool",
    confidence: 0,
    routingRule: "NONE",
  };
}

/**
 * Route based on email category
 */
function routeByCategory(
  emailData: EmailData,
  teamMembers: TeamMember[]
): RoutingResult | null {
  const category = emailData.category;

  // Tax filing
  if (category === "tax_filing") {
    const taxPreparer = teamMembers.find(m => m.role === "tax_preparer" || m.role === "accountant");
    if (taxPreparer) {
      return {
        assignedTo: taxPreparer.id,
        reason: "Tax filing - assigned to tax preparer",
        confidence: ROUTING_RULES.TAX_FILING.confidence,
        routingRule: "TAX_FILING",
      };
    }
  }

  // Compliance
  if (category === "compliance") {
    const complianceSpecialist = teamMembers.find(m => m.role === "compliance_specialist" || m.role === "senior_accountant");
    if (complianceSpecialist) {
      return {
        assignedTo: complianceSpecialist.id,
        reason: "Compliance matter - assigned to specialist",
        confidence: ROUTING_RULES.COMPLIANCE.confidence,
        routingRule: "COMPLIANCE",
      };
    }
  }

  // Document request
  if (category === "document_request") {
    const staffMember = teamMembers.find(m => m.role === "staff" || m.role === "admin");
    if (staffMember) {
      return {
        assignedTo: staffMember.id,
        reason: "Document request - assigned to staff",
        confidence: ROUTING_RULES.DOCUMENT_REQUEST.confidence,
        routingRule: "DOCUMENT_REQUEST",
      };
    }
  }

  // Payment
  if (category === "payment") {
    const billingSpecialist = teamMembers.find(m => m.role === "billing_specialist" || m.role === "admin");
    if (billingSpecialist) {
      return {
        assignedTo: billingSpecialist.id,
        reason: "Payment matter - assigned to billing specialist",
        confidence: ROUTING_RULES.PAYMENT.confidence,
        routingRule: "PAYMENT",
      };
    }
  }

  // Appointment
  if (category === "appointment") {
    const admin = teamMembers.find(m => m.role === "admin" || m.role === "staff");
    if (admin) {
      return {
        assignedTo: admin.id,
        reason: "Appointment scheduling - assigned to admin",
        confidence: ROUTING_RULES.APPOINTMENT.confidence,
        routingRule: "APPOINTMENT",
      };
    }
  }

  return null;
}

/**
 * Route based on extracted amounts
 */
function routeByAmount(
  emailData: EmailData,
  teamMembers: TeamMember[]
): RoutingResult | null {
  if (!emailData.extractedAmounts || emailData.extractedAmounts.length === 0) {
    return null;
  }

  const maxAmount = Math.max(...emailData.extractedAmounts.map(a => a.value));

  // High value (>= $10,000)
  if (maxAmount >= 10000) {
    const seniorAccountant = teamMembers.find(m =>
      m.role === "senior_accountant" || m.role === "manager" || m.role === "owner"
    );
    if (seniorAccountant) {
      return {
        assignedTo: seniorAccountant.id,
        reason: `High-value transaction ($${maxAmount.toLocaleString()}) - assigned to senior staff`,
        confidence: ROUTING_RULES.HIGH_VALUE.confidence,
        routingRule: "HIGH_VALUE",
      };
    }
  }

  // Medium value ($5,000 - $10,000)
  if (maxAmount >= 5000 && maxAmount < 10000) {
    const accountant = teamMembers.find(m =>
      m.role === "accountant" || m.role === "senior_accountant"
    );
    if (accountant) {
      return {
        assignedTo: accountant.id,
        reason: `Medium-value transaction ($${maxAmount.toLocaleString()}) - assigned to accountant`,
        confidence: ROUTING_RULES.MEDIUM_VALUE.confidence,
        routingRule: "MEDIUM_VALUE",
      };
    }
  }

  return null;
}

/**
 * Find the team member with the lightest workload
 */
function findLeastBusyMember(teamMembers: TeamMember[]): TeamMember | null {
  if (teamMembers.length === 0) return null;

  // Sort by open task count (lowest first)
  const sorted = [...teamMembers].sort((a, b) => {
    const aCount = a.openTaskCount ?? 999;
    const bCount = b.openTaskCount ?? 999;
    return aCount - bCount;
  });

  return sorted[0];
}

/**
 * Get routing transparency message for UI display
 */
export function getRoutingExplanation(routingResult: RoutingResult): {
  icon: string;
  message: string;
  color: string;
} {
  if (routingResult.confidence >= 0.9) {
    return {
      icon: "🎯",
      message: routingResult.reason,
      color: "green",
    };
  } else if (routingResult.confidence >= 0.7) {
    return {
      icon: "🤖",
      message: routingResult.reason,
      color: "blue",
    };
  } else if (routingResult.confidence >= 0.5) {
    return {
      icon: "⚖️",
      message: routingResult.reason,
      color: "amber",
    };
  } else {
    return {
      icon: "📋",
      message: routingResult.reason,
      color: "gray",
    };
  }
}
