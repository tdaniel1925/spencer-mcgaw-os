// Shared client data and utilities
// Single source of truth for client matching across the application

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

// Empty clients array - real data comes from database
export const clients: Client[] = [];

/**
 * Normalize phone number for comparison
 * Strips all non-digit characters and takes last 10 digits
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Match caller to existing client by phone number
 * TODO: Integrate with real client database lookup
 */
export function matchClientByPhone(callerPhone: string): { id: string; name: string } | null {
  const normalizedCaller = normalizePhone(callerPhone);
  const client = clients.find(c => normalizePhone(c.phone) === normalizedCaller);
  return client ? { id: client.id, name: client.name } : null;
}

/**
 * Match sender to existing client by email
 * TODO: Integrate with real client database lookup
 */
export function matchClientByEmail(email: string): { id: string; name: string } | null {
  const normalizedEmail = email.toLowerCase().trim();
  const client = clients.find(c => c.email.toLowerCase() === normalizedEmail);
  return client ? { id: client.id, name: client.name } : null;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
