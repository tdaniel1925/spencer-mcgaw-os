import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").default("staff"),
  full_name: text("full_name"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

async function updateRole() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  const result = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, "tdaniel@botmakers.ai"))
    .returning({ id: users.id, email: users.email, role: users.role });

  console.log("Updated user:", result);

  await client.end();
  process.exit(0);
}

updateRole().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
