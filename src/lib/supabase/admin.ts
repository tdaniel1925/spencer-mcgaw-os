import { createClient } from "@supabase/supabase-js";

// Admin client with service role - only use server-side for admin operations
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Password validation rules
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

// Common weak passwords to reject
const COMMON_PASSWORDS = [
  "password",
  "password1",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "login",
  "admin",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "trustno1",
];

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum 8 characters
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // At least one number
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push("Password is too common. Please choose a stronger password");
  }

  // Check for sequential characters (e.g., "abc", "123")
  const lowerPassword = password.toLowerCase();
  for (let i = 0; i < lowerPassword.length - 2; i++) {
    const a = lowerPassword.charCodeAt(i);
    const b = lowerPassword.charCodeAt(i + 1);
    const c = lowerPassword.charCodeAt(i + 2);
    if (b === a + 1 && c === b + 1) {
      errors.push("Password should not contain sequential characters (e.g., abc, 123)");
      break;
    }
  }

  // Check for repeated characters (e.g., "aaa", "111")
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password should not contain 3 or more repeated characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate a random temporary password that meets all requirements
export function generateTemporaryPassword(): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";

  // Ensure at least one of each required type
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
