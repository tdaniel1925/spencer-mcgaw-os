/**
 * Fastmail Connection API
 * POST /api/email/fastmail/connect
 *
 * Allows users to add their Fastmail credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";

const imaps = require("imap-simple");

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { email, appPassword } = body;

    if (!email || !appPassword) {
      return NextResponse.json(
        { error: "Email and app password are required" },
        { status: 400 }
      );
    }

    logger.info("[Fastmail Connect] Testing connection", {
      userId: user.id,
      email,
    });

    // Test IMAP connection before saving
    try {
      const connection = await imaps.connect({
        imap: {
          user: email,
          password: appPassword,
          host: "imap.fastmail.com",
          port: 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: true },
          authTimeout: 10000,
        },
      });

      await connection.end();
      logger.info("[Fastmail Connect] ✅ Connection test successful");
    } catch (error) {
      logger.error("[Fastmail Connect] Connection test failed", { error });
      return NextResponse.json(
        {
          error:
            "Could not connect to Fastmail. Please check your email and app password.",
        },
        { status: 400 }
      );
    }

    // Encrypt the app password
    const encryptedPassword = encrypt(appPassword);

    // Check if connection already exists
    const { data: existing } = await supabase
      .from("email_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("email", email)
      .eq("provider", "imap")
      .single();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from("email_connections")
        .update({
          access_token: encryptedPassword,
          is_active: true,
          sync_errors: 0,
          updated_at: new Date().toISOString(),
          metadata: {
            imapHost: "imap.fastmail.com",
            imapPort: 993,
            imapSecure: true,
            providerName: "fastmail",
          },
        })
        .eq("id", existing.id);

      if (updateError) {
        logger.error("[Fastmail Connect] Failed to update connection", {
          error: updateError,
        });
        return NextResponse.json(
          { error: "Failed to update connection" },
          { status: 500 }
        );
      }

      logger.info("[Fastmail Connect] ✅ Connection updated", {
        userId: user.id,
        email,
      });

      return NextResponse.json({
        success: true,
        message: "Fastmail connection updated successfully",
      });
    } else {
      // Create new connection
      const { data: newConnection, error: insertError } = await supabase
        .from("email_connections")
        .insert({
          user_id: user.id,
          provider: "imap",
          email,
          display_name: email,
          access_token: encryptedPassword,
          is_active: true,
          metadata: {
            imapHost: "imap.fastmail.com",
            imapPort: 993,
            imapSecure: true,
            providerName: "fastmail",
          },
        })
        .select("id")
        .single();

      if (insertError) {
        logger.error("[Fastmail Connect] Failed to create connection", {
          error: insertError,
        });
        return NextResponse.json(
          { error: "Failed to create connection" },
          { status: 500 }
        );
      }

      // Initialize sync state
      await supabase.from("email_sync_state").insert({
        connection_id: newConnection.id,
        user_id: user.id,
        sync_status: "idle",
        sync_error_count: 0,
        total_messages_synced: 0,
      });

      logger.info("[Fastmail Connect] ✅ Connection created", {
        userId: user.id,
        email,
        connectionId: newConnection.id,
      });

      return NextResponse.json({
        success: true,
        message: "Fastmail connection created successfully",
        connectionId: newConnection.id,
      });
    }
  } catch (error) {
    logger.error("[Fastmail Connect] Error", { error });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
