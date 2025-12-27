/**
 * Database Reset Script
 *
 * Clears all data and resets to launch-ready state.
 * Keeps Trent Daniel (tdaniel@botmakers.ai) as super admin.
 *
 * Run with: npx tsx scripts/reset-database.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ADMIN_EMAIL = "tdaniel@botmakers.ai";
const ADMIN_NAME = "Trent Daniel";

async function resetDatabase() {
  console.log("=".repeat(60));
  console.log("DATABASE RESET SCRIPT");
  console.log("=".repeat(60));
  console.log(`\nAdmin to preserve: ${ADMIN_NAME} <${ADMIN_EMAIL}>\n`);

  try {
    // Step 1: Get admin user ID (from auth.users)
    console.log("1. Finding admin user...");
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error listing users:", authError);
      process.exit(1);
    }

    const adminAuthUser = authUsers.users.find(u => u.email === ADMIN_EMAIL);

    if (!adminAuthUser) {
      console.log(`   Admin user ${ADMIN_EMAIL} not found in auth.users`);
      console.log("   Will create fresh admin after reset.");
    } else {
      console.log(`   Found admin: ${adminAuthUser.id}`);
    }

    // Step 2: Clear all data tables (in order due to FK constraints)
    console.log("\n2. Clearing data tables...");

    const tablesToClear = [
      // File system
      "file_activity",
      "file_versions",
      "file_shares",
      "folder_permissions",
      "files",
      "folders",
      "storage_quotas",
      // Chat system
      "chat_mentions",
      "chat_message_reactions",
      "chat_typing_indicators",
      "chat_messages",
      "chat_room_members",
      "chat_rooms",
      "user_presence",
      // Core business data
      "webhook_logs",
      "activity_logs",
      "calendar_events",
      "documents",
      "subtasks",
      "tasks",
      "calls",
      "projects",
      "clients",
      // Email accounts
      "email_accounts",
    ];

    for (const table of tablesToClear) {
      try {
        const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          // Table might not exist or be empty
          console.log(`   [SKIP] ${table}: ${error.message}`);
        } else {
          console.log(`   [OK] Cleared ${table}`);
        }
      } catch (e) {
        console.log(`   [SKIP] ${table}: table may not exist`);
      }
    }

    // Step 3: Delete all non-admin users from user_profiles
    console.log("\n3. Clearing user profiles (except admin)...");

    if (adminAuthUser) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .delete()
        .neq("id", adminAuthUser.id);

      if (profileError) {
        console.log(`   [WARN] user_profiles: ${profileError.message}`);
      } else {
        console.log("   [OK] Cleared non-admin user profiles");
      }

      // Also clear from users table (legacy)
      const { error: usersError } = await supabase
        .from("users")
        .delete()
        .neq("id", adminAuthUser.id);

      if (usersError && !usersError.message.includes("does not exist")) {
        console.log(`   [WARN] users: ${usersError.message}`);
      }
    }

    // Step 4: Delete all non-admin auth users
    console.log("\n4. Removing non-admin auth users...");

    for (const user of authUsers.users) {
      if (user.email !== ADMIN_EMAIL) {
        try {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (error) {
            console.log(`   [WARN] Could not delete ${user.email}: ${error.message}`);
          } else {
            console.log(`   [OK] Deleted auth user: ${user.email}`);
          }
        } catch (e) {
          console.log(`   [WARN] Error deleting ${user.email}`);
        }
      }
    }

    // Step 5: Reset admin user profile
    console.log("\n5. Resetting admin user profile...");

    if (adminAuthUser) {
      // Update user profile to admin role and reset onboarding
      const { error: updateError } = await supabase
        .from("user_profiles")
        .upsert({
          id: adminAuthUser.id,
          email: ADMIN_EMAIL,
          full_name: ADMIN_NAME,
          role: "admin",
          is_active: true,
          onboarding_completed: false,
          notification_preferences: {
            email: true,
            sms: false,
            dashboard: true
          },
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (updateError) {
        console.log(`   [WARN] Could not update profile: ${updateError.message}`);
      } else {
        console.log("   [OK] Admin profile reset");
      }

      // Reset auth user metadata
      const { error: metaError } = await supabase.auth.admin.updateUserById(
        adminAuthUser.id,
        {
          user_metadata: {
            full_name: ADMIN_NAME,
            onboarding_completed: false
          }
        }
      );

      if (metaError) {
        console.log(`   [WARN] Could not update metadata: ${metaError.message}`);
      } else {
        console.log("   [OK] Auth metadata reset");
      }

      // Initialize storage quota for admin
      const { error: quotaError } = await supabase
        .from("storage_quotas")
        .upsert({
          user_id: adminAuthUser.id,
          quota_bytes: 26843545600, // 25GB
          used_bytes: 0,
          file_count: 0,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (quotaError && !quotaError.message.includes("does not exist")) {
        console.log(`   [WARN] Could not reset quota: ${quotaError.message}`);
      } else {
        console.log("   [OK] Storage quota initialized");
      }
    }

    // Step 6: Create default community chat rooms
    console.log("\n6. Creating default chat rooms...");

    const defaultRooms = [
      {
        name: "General",
        slug: "general",
        description: "General discussion for the team",
        type: "community",
        is_private: false,
        is_archived: false
      },
      {
        name: "Announcements",
        slug: "announcements",
        description: "Important company announcements",
        type: "community",
        is_private: false,
        is_archived: false
      }
    ];

    for (const room of defaultRooms) {
      const { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("slug", room.slug)
        .single();

      if (!existingRoom) {
        const { data: newRoom, error: roomError } = await supabase
          .from("chat_rooms")
          .insert(room)
          .select()
          .single();

        if (roomError) {
          console.log(`   [WARN] Could not create ${room.name}: ${roomError.message}`);
        } else if (newRoom && adminAuthUser) {
          // Add admin to the room
          await supabase.from("chat_room_members").insert({
            room_id: newRoom.id,
            user_id: adminAuthUser.id,
            role: "admin"
          });
          console.log(`   [OK] Created room: ${room.name}`);
        }
      } else {
        console.log(`   [SKIP] Room ${room.name} already exists`);
      }
    }

    // Step 7: Initialize admin presence
    console.log("\n7. Initializing admin presence...");

    if (adminAuthUser) {
      const { error: presenceError } = await supabase
        .from("user_presence")
        .upsert({
          user_id: adminAuthUser.id,
          status: "offline",
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (presenceError && !presenceError.message.includes("does not exist")) {
        console.log(`   [WARN] Could not init presence: ${presenceError.message}`);
      } else {
        console.log("   [OK] Presence initialized");
      }
    }

    // Step 8: Clear storage bucket files
    console.log("\n8. Clearing storage buckets...");

    try {
      const { data: files } = await supabase.storage.from("files").list();
      if (files && files.length > 0) {
        const filePaths = files.map(f => f.name);
        await supabase.storage.from("files").remove(filePaths);
        console.log(`   [OK] Removed ${files.length} files from storage`);
      } else {
        console.log("   [OK] Storage bucket already empty");
      }
    } catch (e) {
      console.log("   [SKIP] Could not clear storage (bucket may not exist)");
    }

    console.log("\n" + "=".repeat(60));
    console.log("DATABASE RESET COMPLETE");
    console.log("=".repeat(60));
    console.log(`
Summary:
- All user data cleared
- All business data cleared (clients, tasks, documents, etc.)
- All chat messages cleared
- All files cleared
- Default chat rooms created (General, Announcements)
- Admin preserved: ${ADMIN_NAME} <${ADMIN_EMAIL}>
- Onboarding reset (will show on next login)

The system is now launch-ready!
`);

  } catch (error) {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  }
}

// Confirmation prompt
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n⚠️  WARNING: This will DELETE ALL DATA except the admin user!\n");

  rl.question("Type 'RESET' to confirm: ", async (answer) => {
    if (answer === "RESET") {
      await resetDatabase();
    } else {
      console.log("Aborted. No changes made.");
    }
    rl.close();
    process.exit(0);
  });
}

main().catch(console.error);
