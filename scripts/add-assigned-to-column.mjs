import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function addAssignedToColumn() {
  const client = await pool.connect();
  try {
    console.log("Adding assigned_to and assigned_at columns to tasks table...\n");

    // Add assigned_to column
    await client.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id)
    `);
    console.log("✓ Added assigned_to, assigned_at, assigned_by columns");

    // Add permission for task assignment
    console.log("\nChecking/creating task assignment permission...");

    // Check if permission exists
    const permCheck = await client.query(`
      SELECT id FROM permissions WHERE code = 'tasks.assign'
    `);

    if (permCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO permissions (code, name, description, category)
        VALUES ('tasks.assign', 'Assign Tasks', 'Can assign tasks to other users', 'Tasks')
      `);
      console.log("✓ Created tasks.assign permission");
    } else {
      console.log("✓ tasks.assign permission already exists");
    }

    // Grant permission to admin role
    const adminRoleRes = await client.query(`
      SELECT id FROM roles WHERE name = 'Admin' OR name = 'admin' LIMIT 1
    `);

    if (adminRoleRes.rows.length > 0) {
      const adminRoleId = adminRoleRes.rows[0].id;
      const permRes = await client.query(`SELECT id FROM permissions WHERE code = 'tasks.assign'`);
      if (permRes.rows.length > 0) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [adminRoleId, permRes.rows[0].id]);
        console.log("✓ Granted tasks.assign permission to Admin role");
      }
    }

    console.log("\nMigration complete!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

addAssignedToColumn().catch(console.error);
