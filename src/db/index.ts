import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

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
