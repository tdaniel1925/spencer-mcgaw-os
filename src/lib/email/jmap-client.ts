/**
 * JMAP Email Client
 *
 * Handles JMAP email account connections and message syncing.
 * JMAP is a modern, JSON-based email protocol (RFC 8620).
 *
 * SETUP REQUIRED:
 * 1. npm install jmap-client (or use native fetch for HTTP/2)
 * 2. Add encryption key to env: ENCRYPTION_KEY
 * 3. Configure JMAP settings in email connection
 */

import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/shared/encryption';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const JmapConfigSchema = z.object({
  apiUrl: z.string().url('Valid JMAP API URL is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  bearer: z.string().optional(), // For OAuth-based JMAP providers
});

export type JmapConfig = z.infer<typeof JmapConfigSchema>;

export interface JmapEmailMessage {
  id: string;
  messageId: string;
  from: { email: string; name?: string }[];
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
  attachments: Array<{
    blobId: string;
    name: string;
    type: string;
    size: number;
  }>;
  headers: Record<string, string>;
}

export interface JmapConnectionResult {
  success: boolean;
  connectionId?: string;
  email?: string;
  error?: string;
}

export interface JmapSyncResult {
  success: boolean;
  messagesSynced: number;
  errors: string[];
}

interface JmapResponse {
  methodResponses: Array<[string, any, string]>;
  sessionState: string;
}

// ============================================================================
// JMAP CLIENT SERVICE
// ============================================================================

export class JmapClient {
  private config: JmapConfig;
  private connectionId: string;
  private sessionState: string | null = null;

  constructor(config: JmapConfig, connectionId: string) {
    // Validate config
    const validatedConfig = JmapConfigSchema.parse(config);
    this.config = validatedConfig;
    this.connectionId = connectionId;
  }

  /**
   * Make JMAP API request
   */
  private async request(methodCalls: Array<[string, any, string]>): Promise<JmapResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Use bearer token if available, otherwise use Basic Auth
      if (this.config.bearer) {
        headers['Authorization'] = `Bearer ${this.config.bearer}`;
      } else {
        const credentials = btoa(`${this.config.username}:${this.config.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
          methodCalls,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JMAP request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.sessionState = data.sessionState;

      return data;
    } catch (error) {
      logger.error('[JMAP] Request failed', {
        connectionId: this.connectionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Test JMAP connection by fetching mailboxes
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.request([
        [
          'Mailbox/query',
          {
            accountId: this.config.accountId,
            filter: {},
            limit: 1,
          },
          'q0',
        ],
      ]);

      // Check if we got a valid response
      const methodResponse = response.methodResponses[0];
      if (!methodResponse || methodResponse[0] !== 'Mailbox/query') {
        return false;
      }

      logger.info('[JMAP] Connection test successful', {
        connectionId: this.connectionId,
        accountId: this.config.accountId,
      });

      return true;
    } catch (error) {
      logger.error('[JMAP] Connection test failed', {
        connectionId: this.connectionId,
        error,
      });
      return false;
    }
  }

  /**
   * Fetch messages from inbox
   */
  async fetchMessages(options: {
    mailboxId?: string;
    limit?: number;
    since?: Date;
    unseenOnly?: boolean;
  } = {}): Promise<JmapEmailMessage[]> {
    const { mailboxId, limit = 100, since, unseenOnly = false } = options;

    try {
      // Build filter
      const filter: any = {};
      if (mailboxId) {
        filter.inMailbox = mailboxId;
      }
      if (since) {
        filter.after = since.toISOString();
      }
      if (unseenOnly) {
        filter.hasKeyword = '$seen';
        filter.notKeyword = '$seen';
      }

      // Query email IDs
      const queryResponse = await this.request([
        [
          'Email/query',
          {
            accountId: this.config.accountId,
            filter,
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit,
          },
          'q0',
        ],
      ]);

      const queryResult = queryResponse.methodResponses[0];
      if (queryResult[0] !== 'Email/query') {
        throw new Error('Unexpected response type');
      }

      const emailIds = queryResult[1].ids;
      if (!emailIds || emailIds.length === 0) {
        return [];
      }

      // Fetch email details
      const getResponse = await this.request([
        [
          'Email/get',
          {
            accountId: this.config.accountId,
            ids: emailIds,
            properties: [
              'id',
              'messageId',
              'from',
              'to',
              'cc',
              'bcc',
              'subject',
              'textBody',
              'htmlBody',
              'bodyValues',
              'receivedAt',
              'keywords',
              'hasAttachment',
              'attachments',
              'headers',
            ],
          },
          'g0',
        ],
      ]);

      const getResult = getResponse.methodResponses[0];
      if (getResult[0] !== 'Email/get') {
        throw new Error('Unexpected response type');
      }

      const emails = getResult[1].list;

      // Parse messages
      const parsed: JmapEmailMessage[] = emails.map((email: any) => {
        // Extract body text
        let body = '';
        let bodyHtml: string | undefined;

        if (email.textBody && email.textBody.length > 0) {
          const textPartId = email.textBody[0].partId;
          body = email.bodyValues?.[textPartId]?.value || '';
        }

        if (email.htmlBody && email.htmlBody.length > 0) {
          const htmlPartId = email.htmlBody[0].partId;
          bodyHtml = email.bodyValues?.[htmlPartId]?.value;
        }

        // Parse addresses
        const parseAddresses = (addrs: any[]): { email: string; name?: string }[] => {
          if (!addrs || !Array.isArray(addrs)) return [];
          return addrs.map((addr) => ({
            email: addr.email,
            name: addr.name || undefined,
          }));
        };

        // Parse attachments
        const attachments = (email.attachments || []).map((att: any) => ({
          blobId: att.blobId,
          name: att.name,
          type: att.type,
          size: att.size,
        }));

        return {
          id: email.id,
          messageId: email.messageId || email.id,
          from: parseAddresses(email.from),
          to: parseAddresses(email.to),
          cc: email.cc ? parseAddresses(email.cc) : undefined,
          bcc: email.bcc ? parseAddresses(email.bcc) : undefined,
          subject: email.subject || '(No Subject)',
          body,
          bodyHtml,
          date: new Date(email.receivedAt),
          isRead: email.keywords?.$seen === true,
          hasAttachments: email.hasAttachment || false,
          attachments,
          headers: email.headers || {},
        };
      });

      logger.info('[JMAP] Fetched messages', {
        connectionId: this.connectionId,
        count: parsed.length,
      });

      return parsed;
    } catch (error) {
      logger.error('[JMAP] Fetch messages failed', {
        connectionId: this.connectionId,
        error,
      });
      throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available mailboxes
   */
  async listMailboxes(): Promise<Array<{ id: string; name: string; role?: string }>> {
    try {
      const response = await this.request([
        [
          'Mailbox/get',
          {
            accountId: this.config.accountId,
            properties: ['id', 'name', 'role', 'sortOrder'],
          },
          'm0',
        ],
      ]);

      const methodResponse = response.methodResponses[0];
      if (methodResponse[0] !== 'Mailbox/get') {
        throw new Error('Unexpected response type');
      }

      const mailboxes = methodResponse[1].list.map((mailbox: any) => ({
        id: mailbox.id,
        name: mailbox.name,
        role: mailbox.role || undefined,
      }));

      logger.info('[JMAP] Listed mailboxes', {
        connectionId: this.connectionId,
        count: mailboxes.length,
      });

      return mailboxes;
    } catch (error) {
      logger.error('[JMAP] List mailboxes failed', {
        connectionId: this.connectionId,
        error,
      });
      throw new Error(`Failed to list mailboxes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(emailIds: string[]): Promise<void> {
    try {
      await this.request([
        [
          'Email/set',
          {
            accountId: this.config.accountId,
            update: Object.fromEntries(
              emailIds.map((id) => [
                id,
                {
                  keywords: { $seen: true },
                },
              ])
            ),
          },
          's0',
        ],
      ]);

      logger.info('[JMAP] Marked messages as read', {
        connectionId: this.connectionId,
        count: emailIds.length,
      });
    } catch (error) {
      logger.error('[JMAP] Mark as read failed', {
        connectionId: this.connectionId,
        error,
      });
      throw error;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create JMAP connection in database
 */
export async function createJmapConnection(
  userId: string,
  config: JmapConfig
): Promise<JmapConnectionResult> {
  try {
    // Validate config
    const validatedConfig = JmapConfigSchema.parse(config);

    // Test connection first
    const client = new JmapClient(validatedConfig, 'test');
    const isValid = await client.testConnection();
    if (!isValid) {
      return {
        success: false,
        error: 'Failed to connect to JMAP server. Please check your credentials.',
      };
    }

    // Encrypt password
    const encryptedPassword = encrypt(validatedConfig.password);

    // Store metadata
    const metadata = {
      apiUrl: validatedConfig.apiUrl,
      accountId: validatedConfig.accountId,
      username: validatedConfig.username,
    };

    // Save to database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('email_connections')
      .insert({
        user_id: userId,
        provider: 'imap', // Note: Using 'imap' since enum doesn't have 'jmap' yet
        email: validatedConfig.username,
        display_name: validatedConfig.username,
        access_token: encryptedPassword, // Store encrypted password in access_token field
        refresh_token: validatedConfig.bearer ? encrypt(validatedConfig.bearer) : null,
        expires_at: null,
        scopes: null,
        is_active: true,
        metadata: { ...metadata, provider_type: 'jmap' }, // Add provider_type to distinguish
      })
      .select('id, email')
      .single();

    if (error) {
      logger.error('[JMAP] Failed to save connection', { userId, error });
      return {
        success: false,
        error: 'Failed to save email connection',
      };
    }

    logger.info('[JMAP] Connection created', {
      userId,
      connectionId: data.id,
      email: validatedConfig.username,
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

    logger.error('[JMAP] Create connection failed', { userId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync JMAP messages to database
 */
export async function syncJmapMessages(connectionId: string): Promise<JmapSyncResult> {
  const supabase = await createClient();
  const errors: string[] = [];

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      throw new Error('JMAP connection not found');
    }

    // Decrypt password
    const password = decrypt(connection.access_token);
    const metadata = connection.metadata as Record<string, any>;

    // Check if this is actually a JMAP connection
    if (metadata.provider_type !== 'jmap') {
      throw new Error('Not a JMAP connection');
    }

    // Create JMAP client
    const config: JmapConfig = {
      apiUrl: metadata.apiUrl,
      accountId: metadata.accountId,
      username: metadata.username,
      password,
      bearer: connection.refresh_token ? decrypt(connection.refresh_token) : undefined,
    };

    const client = new JmapClient(config, connectionId);

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
          from_email: message.from[0]?.email,
          from_name: message.from[0]?.name,
          to_emails: message.to.map((a) => a.email),
          cc_emails: message.cc?.map((a) => a.email),
          subject: message.subject,
          body_preview: message.body.substring(0, 200),
          body_text: message.body,
          body_html: message.bodyHtml,
          received_at: message.date.toISOString(),
          is_read: message.isRead,
          has_attachments: message.hasAttachments,
          metadata: {
            headers: message.headers,
            attachments: message.attachments,
          },
        });

        messagesSynced++;
      } catch (error) {
        logger.error('[JMAP] Failed to save message', { connectionId, messageId: message.messageId, error });
        errors.push(`Failed to save message ${message.messageId}`);
      }
    }

    // Update last sync time
    await supabase
      .from('email_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    logger.info('[JMAP] Sync completed', {
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
    logger.error('[JMAP] Sync failed', { connectionId, error });
    return {
      success: false,
      messagesSynced: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Get JMAP client for a connection
 */
export async function getJmapClient(connectionId: string): Promise<JmapClient> {
  const supabase = await createClient();

  const { data: connection, error } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    throw new Error('JMAP connection not found');
  }

  const metadata = connection.metadata as Record<string, any>;
  if (metadata.provider_type !== 'jmap') {
    throw new Error('Not a JMAP connection');
  }

  // Decrypt password
  const password = decrypt(connection.access_token);

  const config: JmapConfig = {
    apiUrl: metadata.apiUrl,
    accountId: metadata.accountId,
    username: metadata.username,
    password,
    bearer: connection.refresh_token ? decrypt(connection.refresh_token) : undefined,
  };

  return new JmapClient(config, connectionId);
}
