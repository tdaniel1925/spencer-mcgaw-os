/**
 * Real-Time Email Watcher (IMAP IDLE)
 * Instantly processes new emails as they arrive using IMAP IDLE
 *
 * Run: node scripts/email-realtime-watcher.mjs
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import imaps from 'imap-simple';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { simpleParser } from 'mailparser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const connections = new Map();

// Decrypt function from @/lib/shared/crypto
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn("WARNING: ENCRYPTION_KEY not set. Using derived key - NOT SECURE FOR PRODUCTION");
    return crypto.scryptSync("development-only-key", "salt", 32);
  }

  // If key is hex encoded (64 characters = 32 bytes) - EXACT MATCH with crypto.ts
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If key is base64 encoded - EXACT MATCH with crypto.ts
  if (/^[A-Za-z0-9+/=]+$/.test(key) && key.length >= 32) {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length >= 32) {
      return decoded.subarray(0, 32);
    }
  }

  // Derive a key from the string using scrypt - EXACT MATCH with crypto.ts
  return crypto.scryptSync(key, "spencer-mcgaw-salt", 32);
}

function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  // Not encrypted - return as is - EXACT MATCH with crypto.ts
  if (!encryptedText.startsWith("enc:")) {
    return encryptedText;
  }

  try {
    // Check format version - EXACT MATCH with crypto.ts
    if (encryptedText.startsWith("enc:v2:")) {
      // v2 format: enc:v2:{iv}:{authTag}:{ciphertext}
      const parts = encryptedText.split(":");
      if (parts.length !== 5) {
        throw new Error("Invalid encrypted data format");
      }

      const [, , ivBase64, authTagBase64, ciphertext] = parts;

      const key = getEncryptionKey();
      const iv = Buffer.from(ivBase64, "base64");
      const authTag = Buffer.from(authTagBase64, "base64");

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else {
      // Legacy v1 format: enc:{base64} (simple base64 encoding) - EXACT MATCH with crypto.ts
      const encoded = encryptedText.slice(4);
      const buffer = Buffer.from(encoded, "base64");
      return buffer.toString("utf-8");
    }
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data - key may have changed");
  }
}

async function processNewEmail(item, userId) {
  try {
    // Get the raw email source
    const all = item.parts.find((part) => part.which === '');
    const rawEmail = all?.body || '';

    // Parse with mailparser
    const parsed = await simpleParser(rawEmail);

    const subject = parsed.subject || '(No Subject)';
    const messageId = parsed.messageId || `fastmail-${Date.now()}`;
    const textBody = parsed.text || '';
    const htmlBody = parsed.html || null;
    const receivedDate = parsed.date || new Date();

    // Extract email address - try multiple approaches
    let fromEmail = null;
    let fromName = null;

    // Method 1: Use mailparser's parsed address object (most reliable)
    if (parsed.from?.value && parsed.from.value.length > 0) {
      fromEmail = parsed.from.value[0].address?.toLowerCase();
      fromName = parsed.from.value[0].name || fromEmail;
    }

    // Method 2: Fallback to text parsing
    if (!fromEmail && parsed.from?.text) {
      const from = parsed.from.text;
      const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
      fromEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : null;
      const nameMatch = from.match(/^([^<]+)</);
      fromName = nameMatch ? nameMatch[1].trim() : fromEmail;
    }

    if (!fromEmail) {
      console.log('⚠️  Could not extract email address from:', JSON.stringify(parsed.from));
      return;
    }

    console.log(`📧 New email: "${subject}" from ${fromName} <${fromEmail}>`);

    // Store email in database
    const { data: emailMessage, error: emailError } = await supabase
      .from('email_messages')
      .upsert({
        user_id: userId,
        connection_id: null,
        message_id: messageId,
        internet_message_id: messageId,
        subject: subject,
        from_email: fromEmail,
        from_name: fromName,
        to_recipients: [],
        body_preview: textBody.substring(0, 500),
        body_html: htmlBody,
        body_text: textBody,
        received_at: receivedDate.toISOString(),
        sent_at: receivedDate.toISOString(),
        importance: 'normal',
        is_read: false,
        is_flagged: false,
        is_draft: false,
        has_attachments: false,
        attachment_count: 0,
        folder: 'inbox',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (emailError) {
      console.error('❌ Failed to save email:', emailError);
      return;
    }

    console.log('✅ Email saved to database');

    // AI analysis would go here
    // const analysis = await analyzeEmailForTask({ ... });

  } catch (error) {
    console.error('❌ Error processing email:', error);
  }
}

async function watchAccount(connection, userId, email) {
  try {
    console.log(`👁️  Watching ${email} for new emails...`);

    const imapConnection = await imaps.connect({
      imap: {
        user: connection.email,
        password: decrypt(connection.access_token),
        host: connection.metadata?.imapHost || 'imap.fastmail.com',
        port: connection.metadata?.imapPort || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: true },
        authTimeout: 10000,
      },
    });

    await imapConnection.openBox('INBOX');

    // Set up IDLE - this keeps connection open and waits for new emails
    imapConnection.on('mail', async (numNewMsgs) => {
      console.log(`\n📬 ${numNewMsgs} new email(s) arrived for ${email}!`);

      try {
        // Fetch only UNSEEN messages
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
          bodies: ['HEADER', 'TEXT'],
          markSeen: true,
        };

        const messages = await imapConnection.search(searchCriteria, fetchOptions);

        for (const item of messages) {
          await processNewEmail(item, userId);
        }
      } catch (error) {
        console.error('❌ Error fetching new emails:', error);
      }
    });

    // Start IDLE
    imapConnection.imap.on('close', () => {
      console.log(`⚠️  Connection closed for ${email}, reconnecting...`);
      setTimeout(() => watchAccount(connection, userId, email), 5000);
    });

    imapConnection.imap.on('error', (err) => {
      console.error(`❌ IMAP error for ${email}:`, err);
    });

    connections.set(userId, imapConnection);

  } catch (error) {
    console.error(`❌ Failed to watch ${email}:`, error);
    // Retry after 30 seconds
    setTimeout(() => watchAccount(connection, userId, email), 30000);
  }
}

async function startWatching() {
  console.log('🚀 Starting real-time email watcher...\n');

  try {
    // Get all active IMAP connections
    const { data: emailConnections, error } = await supabase
      .from('email_connections')
      .select('id, user_id, email, access_token, metadata')
      .eq('provider', 'imap')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Failed to fetch email connections:', error);
      process.exit(1);
    }

    if (!emailConnections || emailConnections.length === 0) {
      console.log('⚠️  No Fastmail accounts connected. Connect one in Settings → Email');
      process.exit(0);
    }

    console.log(`📧 Found ${emailConnections.length} Fastmail account(s)\n`);

    // Watch each account
    for (const conn of emailConnections) {
      await watchAccount(conn, conn.user_id, conn.email);
    }

    console.log('\n✅ All accounts are being watched in real-time!');
    console.log('📬 New emails will appear instantly in your dashboard\n');

  } catch (error) {
    console.error('❌ Failed to start watcher:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  for (const [userId, conn] of connections) {
    await conn.end();
  }
  process.exit(0);
});

startWatching();
