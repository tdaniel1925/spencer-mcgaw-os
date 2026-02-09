/**
 * IMAP Email Client
 *
 * Handles IMAP email account connections and message syncing.
 * Supports standard IMAP servers (Gmail, Outlook, Yahoo, custom).
 *
 * SETUP REQUIRED:
 * 1. npm install imap-simple
 * 2. Add encryption key to env: ENCRYPTION_KEY
 * 3. Configure IMAP settings in email connection
 */

import imaps from 'imap-simple';
import type { ImapSimpleOptions, Message } from 'imap-simple';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/shared/encryption';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const ImapConfigSchema = z.object({
  host: z.string().min(1, 'IMAP host is required'),
  port: z.number().int().min(1).max(65535).default(993),
  user: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  tls: z.boolean().default(true),
  authTimeout: z.number().int().positive().optional().default(10000),
});

export type ImapConfig = z.infer<typeof ImapConfigSchema>;

export interface ImapEmailMessage {
  id: string;
  messageId: string;
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }>;
  headers: Record<string, string>;
}

export interface ImapConnectionResult {
  success: boolean;
  connectionId?: string;
  email?: string;
  error?: string;
}

export interface ImapSyncResult {
  success: boolean;
  messagesSynced: number;
  errors: string[];
}

// ============================================================================
// IMAP CLIENT SERVICE
// ============================================================================

export class ImapClient {
  private connection: any = null;
  private config: ImapConfig;
  private connectionId: string;

  constructor(config: ImapConfig, connectionId: string) {
    // Validate config
    const validatedConfig = ImapConfigSchema.parse(config);
    this.config = validatedConfig;
    this.connectionId = connectionId;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    try {
      const options: ImapSimpleOptions = {
        imap: {
          user: this.config.user,
          password: this.config.password,
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls,
          authTimeout: this.config.authTimeout,
          tlsOptions: {
            rejectUnauthorized: false, // Allow self-signed certs for corporate email
          },
        },
      };

      this.connection = await imaps.connect(options);
      logger.info('[IMAP] Connected successfully', {
        connectionId: this.connectionId,
        host: this.config.host,
        user: this.config.user,
      });
    } catch (error) {
      logger.error('[IMAP] Connection failed', {
        connectionId: this.connectionId,
        host: this.config.host,
        error,
      });
      throw new Error(`Failed to connect to IMAP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        logger.info('[IMAP] Disconnected', { connectionId: this.connectionId });
      } catch (error) {
        logger.warn('[IMAP] Disconnect warning', { connectionId: this.connectionId, error });
      }
      this.connection = null;
    }
  }

  /**
   * Test IMAP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch (error) {
      logger.error('[IMAP] Connection test failed', { error });
      return false;
    }
  }

  /**
   * Fetch messages from inbox
   */
  async fetchMessages(options: {
    folder?: string;
    limit?: number;
    since?: Date;
    unseenOnly?: boolean;
  } = {}): Promise<ImapEmailMessage[]> {
    const { folder = 'INBOX', limit = 100, since, unseenOnly = false } = options;

    if (!this.connection) {
      await this.connect();
    }

    try {
      // Open mailbox
      await this.connection.openBox(folder);

      // Build search criteria
      const searchCriteria: any[] = ['ALL'];
      if (unseenOnly) {
        searchCriteria.push('UNSEEN');
      }
      if (since) {
        searchCriteria.push(['SINCE', since]);
      }

      // Fetch options
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false,
        struct: true,
      };

      // Search and fetch
      const messages = await this.connection.search(searchCriteria, fetchOptions);

      // Parse messages
      const parsed: ImapEmailMessage[] = [];
      for (const item of messages.slice(0, limit)) {
        try {
          const message = this.parseMessage(item);
          parsed.push(message);
        } catch (error) {
          logger.warn('[IMAP] Failed to parse message', { error });
          continue;
        }
      }

      logger.info('[IMAP] Fetched messages', {
        connectionId: this.connectionId,
        folder,
        count: parsed.length,
      });

      return parsed;
    } catch (error) {
      logger.error('[IMAP] Fetch messages failed', {
        connectionId: this.connectionId,
        folder,
        error,
      });
      throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse IMAP message into our format
   */
  private parseMessage(item: Message): ImapEmailMessage {
    const all = item.parts.find((part: any) => part.which === '');
    const id = item.attributes.uid;
    const idHeader = 'Message-ID';

    // Parse headers
    const headers: Record<string, string> = {};
    const header = item.parts.find((part: any) => part.which === 'HEADER');
    if (header) {
      // Simple header parsing
      const headerLines = header.body.toString().split('\r\n');
      for (const line of headerLines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          headers[match[1].toLowerCase()] = match[2];
        }
      }
    }

    // Extract email and name from address
    const parseAddress = (addr: string): { email: string; name?: string } => {
      const match = addr.match(/^(?:"?([^"<]+)"?\s*)?<?([^>]+)>?$/);
      if (match) {
        return { email: match[2].trim(), name: match[1]?.trim() };
      }
      return { email: addr.trim() };
    };

    const fromAddr = parseAddress(headers['from'] || '');
    const toAddrs = (headers['to'] || '').split(',').map((a) => a.trim());
    const ccAddrs = (headers['cc'] || '').split(',').filter(Boolean).map((a) => a.trim());

    // Get body
    const textPart = item.parts.find((part: any) => part.which === 'TEXT');
    const body = textPart ? textPart.body.toString() : '';

    // Check for attachments
    const hasAttachments = item.attributes.struct?.some((part: any) => {
      return part.disposition?.type === 'attachment';
    }) || false;

    return {
      id: id.toString(),
      messageId: headers[idHeader.toLowerCase()] || id.toString(),
      from: fromAddr.email,
      fromName: fromAddr.name,
      to: toAddrs,
      cc: ccAddrs.length > 0 ? ccAddrs : undefined,
      subject: headers['subject'] || '(No Subject)',
      body,
      bodyHtml: undefined, // TODO: Parse HTML part
      date: new Date(headers['date'] || Date.now()),
      isRead: item.attributes.flags?.includes('\\Seen') || false,
      hasAttachments,
      attachments: [], // TODO: Parse attachments
      headers,
    };
  }

  /**
   * List available folders
   */
  async listFolders(): Promise<string[]> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      const boxes = await this.connection.getBoxes();
      const folders: string[] = [];

      const extractFolders = (obj: any, prefix = '') => {
        for (const [name, data] of Object.entries(obj)) {
          const fullName = prefix ? `${prefix}/${name}` : name;
          folders.push(fullName);
          if (data && typeof data === 'object' && (data as any).children) {
            extractFolders((data as any).children, fullName);
          }
        }
      };

      extractFolders(boxes);
      return folders;
    } catch (error) {
      logger.error('[IMAP] List folders failed', { connectionId: this.connectionId, error });
      throw new Error(`Failed to list folders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create IMAP connection in database
 */
export async function createImapConnection(
  userId: string,
  config: ImapConfig
): Promise<ImapConnectionResult> {
  try {
    // Validate config
    const validatedConfig = ImapConfigSchema.parse(config);

    // Test connection first
    const client = new ImapClient(validatedConfig, 'test');
    const isValid = await client.testConnection();
    if (!isValid) {
      return {
        success: false,
        error: 'Failed to connect to IMAP server. Please check your credentials.',
      };
    }

    // Encrypt password
    const encryptedPassword = encrypt(validatedConfig.password);

    // Store metadata
    const metadata = {
      host: validatedConfig.host,
      port: validatedConfig.port,
      tls: validatedConfig.tls,
    };

    // Save to database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('email_connections')
      .insert({
        user_id: userId,
        provider: 'imap',
        email: validatedConfig.user,
        display_name: validatedConfig.user,
        access_token: encryptedPassword, // Store encrypted password in access_token field
        refresh_token: null, // IMAP doesn't use refresh tokens
        expires_at: null, // IMAP passwords don't expire
        scopes: null,
        is_active: true,
        metadata,
      })
      .select('id, email')
      .single();

    if (error) {
      logger.error('[IMAP] Failed to save connection', { userId, error });
      return {
        success: false,
        error: 'Failed to save email connection',
      };
    }

    logger.info('[IMAP] Connection created', {
      userId,
      connectionId: data.id,
      email: validatedConfig.user,
    });

    return {
      success: true,
      connectionId: data.id,
      email: data.email,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    logger.error('[IMAP] Create connection failed', { userId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync IMAP messages to database
 */
export async function syncImapMessages(connectionId: string): Promise<ImapSyncResult> {
  const supabase = await createClient();
  const errors: string[] = [];

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('provider', 'imap')
      .single();

    if (connectionError || !connection) {
      throw new Error('IMAP connection not found');
    }

    // Decrypt password
    const password = decrypt(connection.access_token);
    const metadata = connection.metadata as Record<string, any>;

    // Create IMAP client
    const config: ImapConfig = {
      host: metadata.host,
      port: metadata.port,
      user: connection.email,
      password,
      tls: metadata.tls ?? true,
      authTimeout: metadata.authTimeout ?? 10000,
    };

    const client = new ImapClient(config, connectionId);

    // Fetch messages
    const messages = await client.fetchMessages({
      limit: 100,
      unseenOnly: false,
    });

    // Save messages to database
    let messagesSynced = 0;
    for (const message of messages) {
      try {
        // Check if message already exists
        const { data: existing } = await supabase
          .from('email_messages')
          .select('id')
          .eq('connection_id', connectionId)
          .eq('message_id', message.messageId)
          .single();

        if (existing) {
          continue; // Skip existing messages
        }

        // Insert message
        await supabase.from('email_messages').insert({
          connection_id: connectionId,
          user_id: connection.user_id,
          message_id: message.messageId,
          thread_id: null, // TODO: Implement threading
          from_email: message.from,
          from_name: message.fromName,
          to_emails: message.to,
          cc_emails: message.cc,
          subject: message.subject,
          body_preview: message.body.substring(0, 200),
          body_text: message.body,
          body_html: message.bodyHtml,
          received_at: message.date.toISOString(),
          is_read: message.isRead,
          has_attachments: message.hasAttachments,
          metadata: {
            headers: message.headers,
          },
        });

        messagesSynced++;
      } catch (error) {
        logger.error('[IMAP] Failed to save message', { connectionId, messageId: message.messageId, error });
        errors.push(`Failed to save message ${message.messageId}`);
      }
    }

    // Update last sync time
    await supabase
      .from('email_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    // Disconnect
    await client.disconnect();

    logger.info('[IMAP] Sync completed', {
      connectionId,
      messagesSynced,
      errorCount: errors.length,
    });

    return {
      success: true,
      messagesSynced,
      errors,
    };
  } catch (error) {
    logger.error('[IMAP] Sync failed', { connectionId, error });
    return {
      success: false,
      messagesSynced: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Get IMAP client for a connection
 */
export async function getImapClient(connectionId: string): Promise<ImapClient> {
  const supabase = await createClient();

  const { data: connection, error } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('provider', 'imap')
    .single();

  if (error || !connection) {
    throw new Error('IMAP connection not found');
  }

  // Decrypt password
  const password = decrypt(connection.access_token);
  const metadata = connection.metadata as Record<string, any>;

  const config: ImapConfig = {
    host: metadata.host,
    port: metadata.port,
    user: connection.email,
    password,
    tls: metadata.tls ?? true,
    authTimeout: metadata.authTimeout ?? 10000,
  };

  return new ImapClient(config, connectionId);
}
