// Shared client data and utilities
// Single source of truth for client matching across the application

export interface MockClient {
  id: string;
  name: string;
  phone: string;
  email: string;
}

// Centralized mock clients - in production, this would come from the database
export const mockClients: MockClient[] = [
  { id: "CL001", name: "John Smith", phone: "+1 (555) 123-4567", email: "john.smith@email.com" },
  { id: "CL002", name: "ABC Corporation", phone: "+1 (555) 234-5678", email: "contact@abccorp.com" },
  { id: "CL003", name: "Sarah Johnson", phone: "+1 (555) 345-6789", email: "sarah.j@email.com" },
  { id: "CL004", name: "Tech Solutions LLC", phone: "+1 (555) 456-7890", email: "info@techsolutions.com" },
  { id: "CL005", name: "Mike Williams", phone: "+1 (555) 567-8901", email: "mike.w@consulting.com" },
];

/**
 * Normalize phone number for comparison
 * Strips all non-digit characters and takes last 10 digits
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Match caller to existing client by phone number
 */
export function matchClientByPhone(callerPhone: string): { id: string; name: string } | null {
  const normalizedCaller = normalizePhone(callerPhone);
  const client = mockClients.find(c => normalizePhone(c.phone) === normalizedCaller);
  return client ? { id: client.id, name: client.name } : null;
}

/**
 * Match sender to existing client by email
 */
export function matchClientByEmail(email: string): { id: string; name: string } | null {
  const normalizedEmail = email.toLowerCase().trim();
  const client = mockClients.find(c => c.email.toLowerCase() === normalizedEmail);
  return client ? { id: client.id, name: client.name } : null;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
