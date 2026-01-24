/**
 * Microsoft Graph Email Service
 *
 * Comprehensive service for interacting with Microsoft Graph API for email operations.
 * Handles token refresh, error handling, and provides typed interfaces.
 *
 * @module lib/email/graph-service
 */

import { decrypt, encrypt } from "@/lib/shared/crypto";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// Types
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface GraphEmail {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: "text" | "html";
    content: string;
  };
  from: { emailAddress: EmailAddress };
  toRecipients: Array<{ emailAddress: EmailAddress }>;
  ccRecipients: Array<{ emailAddress: EmailAddress }>;
  bccRecipients: Array<{ emailAddress: EmailAddress }>;
  replyTo: Array<{ emailAddress: EmailAddress }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  flag: {
    flagStatus: "notFlagged" | "flagged" | "complete";
  };
  categories: string[];
  internetMessageId: string;
  webLink: string;
}

export interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string; // Base64 encoded
}

export interface GraphFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface SendEmailOptions {
  subject: string;
  body: string;
  bodyType?: "text" | "html";
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  importance?: "low" | "normal" | "high";
  attachments?: Array<{
    name: string;
    contentType: string;
    contentBytes: string; // Base64
  }>;
}

export interface SearchOptions {
  query: string;
  folder?: string;
  top?: number;
  skip?: number;
}

// Error types
export class GraphServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "GraphServiceError";
  }
}

/**
 * Microsoft Graph Email Service
 * Handles all email operations with Microsoft Graph API
 */
export class GraphEmailService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create service instance from database connection
   * Handles token refresh if needed
   */
  static async fromConnection(userId: string): Promise<GraphEmailService | null> {
    const supabase = await createClient();

    // Get email connection
    const { data: connection, error: connError } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "microsoft")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return null;
    }

    // Decrypt tokens
    let accessToken = decrypt(connection.access_token);
    const refreshToken = connection.refresh_token ? decrypt(connection.refresh_token) : null;

    // Check if token is expired
    if (new Date(connection.expires_at) <= new Date()) {
      if (!refreshToken) {
        throw new GraphServiceError(
          "Token expired and no refresh token available",
          "TOKEN_EXPIRED",
          401
        );
      }

      // Refresh the token
      const newTokens = await GraphEmailService.refreshAccessToken(refreshToken);
      if (!newTokens) {
        throw new GraphServiceError("Failed to refresh access token", "REFRESH_FAILED", 401);
      }

      // Update tokens in database
      accessToken = newTokens.access_token;
      await supabase
        .from("email_connections")
        .update({
          access_token: encrypt(newTokens.access_token),
          refresh_token: encrypt(newTokens.refresh_token),
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }

    return new GraphEmailService(accessToken);
  }

  /**
   * Refresh Microsoft OAuth access token
   */
  private static async refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
    const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_GRAPH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Microsoft OAuth credentials not configured");
      return null;
    }

    try {
      const response = await fetch(MICROSOFT_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Token refresh failed:", errorData);
        return null;
      }

      return response.json();
    } catch (error) {
      console.error("Token refresh error:", error);
      return null;
    }
  }

  /**
   * Make authenticated request to Microsoft Graph
   */
  private async graphRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${MICROSOFT_GRAPH_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new GraphServiceError(
        errorData.error?.message || "Graph API request failed",
        errorData.error?.code || "GRAPH_ERROR",
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get current user's profile
   */
  async getUser(): Promise<GraphUser> {
    return this.graphRequest<GraphUser>("/me");
  }

  /**
   * List mail folders
   */
  async getFolders(): Promise<GraphFolder[]> {
    const data = await this.graphRequest<{ value: GraphFolder[] }>("/me/mailFolders");
    return data.value;
  }

  /**
   * Get emails from a folder
   */
  async getEmails(
    folder: string = "inbox",
    options: { top?: number; skip?: number; orderBy?: string } = {}
  ): Promise<{ emails: GraphEmail[]; nextLink: string | null }> {
    const { top = 50, skip = 0, orderBy = "receivedDateTime desc" } = options;

    // Map folder names to Graph API folder IDs
    const folderMap: Record<string, string> = {
      inbox: "inbox",
      sent: "sentitems",
      drafts: "drafts",
      trash: "deleteditems",
      archive: "archive",
      junk: "junkemail",
    };

    const graphFolder = folderMap[folder.toLowerCase()] || folder;

    const params = new URLSearchParams({
      $top: top.toString(),
      $skip: skip.toString(),
      $orderby: orderBy,
      $select:
        "id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,importance,flag,categories,internetMessageId,webLink",
    });

    const data = await this.graphRequest<{ value: GraphEmail[]; "@odata.nextLink"?: string }>(
      `/me/mailFolders/${graphFolder}/messages?${params}`
    );

    return {
      emails: data.value,
      nextLink: data["@odata.nextLink"] || null,
    };
  }

  /**
   * Get a single email by ID
   */
  async getEmail(emailId: string): Promise<GraphEmail> {
    return this.graphRequest<GraphEmail>(`/me/messages/${emailId}`);
  }

  /**
   * Get emails in a conversation/thread
   */
  async getConversationEmails(conversationId: string): Promise<GraphEmail[]> {
    const params = new URLSearchParams({
      $filter: `conversationId eq '${conversationId}'`,
      $orderby: "receivedDateTime asc",
      $select:
        "id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,importance,flag,categories,internetMessageId,webLink",
    });

    const data = await this.graphRequest<{ value: GraphEmail[] }>(`/me/messages?${params}`);
    return data.value;
  }

  /**
   * Get email attachments
   */
  async getAttachments(emailId: string): Promise<GraphAttachment[]> {
    const data = await this.graphRequest<{ value: GraphAttachment[] }>(
      `/me/messages/${emailId}/attachments`
    );
    return data.value;
  }

  /**
   * Download attachment content
   */
  async getAttachment(emailId: string, attachmentId: string): Promise<GraphAttachment> {
    return this.graphRequest<GraphAttachment>(
      `/me/messages/${emailId}/attachments/${attachmentId}`
    );
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(emailId: string, isRead: boolean = true): Promise<void> {
    await this.graphRequest(`/me/messages/${emailId}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead }),
    });
  }

  /**
   * Flag/star an email
   */
  async flagEmail(emailId: string, flagged: boolean = true): Promise<void> {
    await this.graphRequest(`/me/messages/${emailId}`, {
      method: "PATCH",
      body: JSON.stringify({
        flag: {
          flagStatus: flagged ? "flagged" : "notFlagged",
        },
      }),
    });
  }

  /**
   * Move email to folder
   */
  async moveToFolder(emailId: string, destinationFolderId: string): Promise<GraphEmail> {
    return this.graphRequest<GraphEmail>(`/me/messages/${emailId}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
  }

  /**
   * Delete email (move to trash)
   */
  async deleteEmail(emailId: string): Promise<void> {
    await this.graphRequest(`/me/messages/${emailId}`, {
      method: "DELETE",
    });
  }

  /**
   * Permanently delete email
   */
  async permanentlyDeleteEmail(emailId: string): Promise<void> {
    // First get the email to check if it's in trash
    const email = await this.getEmail(emailId);

    // Delete permanently
    await this.graphRequest(`/me/messages/${emailId}`, {
      method: "DELETE",
    });
  }

  /**
   * Send a new email
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const message = {
      subject: options.subject,
      body: {
        contentType: options.bodyType || "html",
        content: options.body,
      },
      toRecipients: options.to.map((addr) => ({ emailAddress: addr })),
      ccRecipients: options.cc?.map((addr) => ({ emailAddress: addr })) || [],
      bccRecipients: options.bcc?.map((addr) => ({ emailAddress: addr })) || [],
      replyTo: options.replyTo?.map((addr) => ({ emailAddress: addr })) || [],
      importance: options.importance || "normal",
      attachments: options.attachments || [],
    };

    await this.graphRequest("/me/sendMail", {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
  }

  /**
   * Reply to an email
   */
  async replyToEmail(
    emailId: string,
    body: string,
    bodyType: "text" | "html" = "html",
    replyAll: boolean = false
  ): Promise<void> {
    const endpoint = replyAll
      ? `/me/messages/${emailId}/replyAll`
      : `/me/messages/${emailId}/reply`;

    await this.graphRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({
        comment: body,
      }),
    });
  }

  /**
   * Forward an email
   */
  async forwardEmail(
    emailId: string,
    to: EmailAddress[],
    body: string = "",
    bodyType: "text" | "html" = "html"
  ): Promise<void> {
    await this.graphRequest(`/me/messages/${emailId}/forward`, {
      method: "POST",
      body: JSON.stringify({
        comment: body,
        toRecipients: to.map((addr) => ({ emailAddress: addr })),
      }),
    });
  }

  /**
   * Search emails
   */
  async searchEmails(options: SearchOptions): Promise<{ emails: GraphEmail[]; nextLink: string | null }> {
    const { query, folder, top = 50, skip = 0 } = options;

    let endpoint = "/me/messages";
    if (folder) {
      const folderMap: Record<string, string> = {
        inbox: "inbox",
        sent: "sentitems",
        drafts: "drafts",
        trash: "deleteditems",
        archive: "archive",
      };
      const graphFolder = folderMap[folder.toLowerCase()] || folder;
      endpoint = `/me/mailFolders/${graphFolder}/messages`;
    }

    const params = new URLSearchParams({
      $search: `"${query}"`,
      $top: top.toString(),
      $skip: skip.toString(),
      $orderby: "receivedDateTime desc",
      $select:
        "id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance,flag",
    });

    const data = await this.graphRequest<{ value: GraphEmail[]; "@odata.nextLink"?: string }>(
      `${endpoint}?${params}`
    );

    return {
      emails: data.value,
      nextLink: data["@odata.nextLink"] || null,
    };
  }

  /**
   * Create a draft email
   */
  async createDraft(options: SendEmailOptions): Promise<GraphEmail> {
    const message = {
      subject: options.subject,
      body: {
        contentType: options.bodyType || "html",
        content: options.body,
      },
      toRecipients: options.to.map((addr) => ({ emailAddress: addr })),
      ccRecipients: options.cc?.map((addr) => ({ emailAddress: addr })) || [],
      bccRecipients: options.bcc?.map((addr) => ({ emailAddress: addr })) || [],
      importance: options.importance || "normal",
    };

    return this.graphRequest<GraphEmail>("/me/messages", {
      method: "POST",
      body: JSON.stringify(message),
    });
  }

  /**
   * Update a draft email
   */
  async updateDraft(draftId: string, options: Partial<SendEmailOptions>): Promise<GraphEmail> {
    const updates: Record<string, unknown> = {};

    if (options.subject !== undefined) updates.subject = options.subject;
    if (options.body !== undefined) {
      updates.body = {
        contentType: options.bodyType || "html",
        content: options.body,
      };
    }
    if (options.to !== undefined) {
      updates.toRecipients = options.to.map((addr) => ({ emailAddress: addr }));
    }
    if (options.cc !== undefined) {
      updates.ccRecipients = options.cc.map((addr) => ({ emailAddress: addr }));
    }
    if (options.bcc !== undefined) {
      updates.bccRecipients = options.bcc.map((addr) => ({ emailAddress: addr }));
    }
    if (options.importance !== undefined) {
      updates.importance = options.importance;
    }

    return this.graphRequest<GraphEmail>(`/me/messages/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  /**
   * Send an existing draft
   */
  async sendDraft(draftId: string): Promise<void> {
    await this.graphRequest(`/me/messages/${draftId}/send`, {
      method: "POST",
    });
  }

  /**
   * Get unread count for a folder
   */
  async getUnreadCount(folder: string = "inbox"): Promise<number> {
    const folderMap: Record<string, string> = {
      inbox: "inbox",
      sent: "sentitems",
      drafts: "drafts",
      trash: "deleteditems",
      archive: "archive",
    };

    const graphFolder = folderMap[folder.toLowerCase()] || folder;
    const folderData = await this.graphRequest<GraphFolder>(`/me/mailFolders/${graphFolder}`);
    return folderData.unreadItemCount;
  }
}
