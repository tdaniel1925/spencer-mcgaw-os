import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log("Running migrations...");

  // Read SQL file
  const sqlPath = path.join(__dirname, "create-email-tables.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Split by semicolons to execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc("exec_sql", { sql: statement });
      if (error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.log("Success");
      }
    } catch (e) {
      console.error(`Exception: ${e}`);
    }
  }

  console.log("Migrations complete!");
}

runMigrations().catch(console.error);
