import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Please add it to your .env.local file.\n" +
    "Use the direct connection URL (port 5432), not the pooler (port 6543).\n" +
    "Example: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
  );
}

// Warn if using pooler port (6543) - this causes "Tenant not found" errors
if (connectionString.includes(":6543")) {
  console.warn(
    "[DB Warning] DATABASE_URL uses port 6543 (pooler). " +
    "For Drizzle, use port 5432 (direct connection) to avoid 'Tenant not found' errors."
  );
}

// Configure postgres-js for serverless environment
const client = postgres(connectionString, {
  prepare: false,
  ssl: "require",
  max: 1, // Single connection for serverless
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });

export * from "./schema";
