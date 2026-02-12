import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import imaps from 'imap-simple';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { simpleParser } from 'mailparser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Decrypt function
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    return crypto.scryptSync("development-only-key", "salt", 32);
  }
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  if (/^[A-Za-z0-9+/=]+$/.test(key) && key.length >= 32) {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length >= 32) {
      return decoded.subarray(0, 32);
    }
  }
  return crypto.scryptSync(key, "spencer-mcgaw-salt", 32);
}

function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.startsWith("enc:")) {
    return encryptedText;
  }
  try {
    if (encryptedText.startsWith("enc:v2:")) {
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
      const encoded = encryptedText.slice(4);
      const buffer = Buffer.from(encoded, "base64");
      return buffer.toString("utf-8");
    }
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

async function reimportEmails() {
  console.log('📧 Re-importing last 20 emails with proper formatting...\n');

  // Get Fastmail connection
  const { data: connections, error: connError } = await supabase
    .from('email_connections')
    .select('id, user_id, email, access_token, metadata')
    .eq('provider', 'imap')
    .eq('is_active', true);

  if (connError || !connections || connections.length === 0) {
    console.error('❌ No Fastmail connection found');
    process.exit(1);
  }

  const connection = connections[0];
  const appPassword = decrypt(connection.access_token);
  const metadata = connection.metadata || {};

  console.log(`Connecting to ${connection.email}...`);

  const imapConnection = await imaps.connect({
    imap: {
      user: connection.email,
      password: appPassword,
      host: metadata.imapHost || 'imap.fastmail.com',
      port: metadata.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: true },
      authTimeout: 10000,
    },
  });

  await imapConnection.openBox('INBOX');
  console.log('✅ Connected to INBOX');

  // Fetch last 20 messages (ALL, not just UNSEEN)
  const searchCriteria = ['ALL'];
  const fetchOptions = {
    bodies: [''],
    markSeen: false,
  };

  const messages = await imapConnection.search(searchCriteria, fetchOptions);

  // Get the last 20
  const recentMessages = messages.slice(-20);

  console.log(`Processing ${recentMessages.length} emails...`);

  let processed = 0;
  for (const item of recentMessages) {
    try {
      // Get raw email
      const all = item.parts.find((part) => part.which === '');
      const rawEmail = all?.body || '';

      // Parse with mailparser
      const parsed = await simpleParser(rawEmail);

      const from = parsed.from?.text || '';
      const subject = parsed.subject || '(No Subject)';
      const messageId = parsed.messageId || `fastmail-${Date.now()}`;
      const textBody = parsed.text || '';
      const htmlBody = parsed.html || null;
      const receivedDate = parsed.date || new Date();

      // Extract email address
      const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[1].trim().toLowerCase() : null;

      if (!fromEmail) continue;

      // Extract name
      const nameMatch = from.match(/^([^<]+)</);
      const fromName = nameMatch ? nameMatch[1].trim() : fromEmail;

      // Store email
      const { error: emailError } = await supabase
        .from('email_messages')
        .upsert({
          user_id: connection.user_id,
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
        });

      if (!emailError) {
        processed++;
        console.log(`✅ ${processed}. "${subject.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.error('Error processing email:', error.message);
    }
  }

  await imapConnection.end();
  console.log(`\n✅ Re-imported ${processed} emails with proper formatting!`);
}

reimportEmails().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
