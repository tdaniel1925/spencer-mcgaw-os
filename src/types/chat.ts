/**
 * Chat System Type Definitions
 *
 * Complete TypeScript interfaces for the internal chat system.
 * These match the Drizzle schema definitions and Supabase tables.
 */

// ============================================================================
// CHAT ROOM TYPES
// ============================================================================

export type ChatRoomType = 'community' | 'team' | 'direct' | 'private';

export interface ChatRoom {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: ChatRoomType;
  isPrivate: boolean;
  isArchived: boolean;
  icon?: string;
  color?: string;
  participantIds?: string[];
  lastMessageAt?: string;
  messageCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoomWithCreator extends ChatRoom {
  creator?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}

// ============================================================================
// CHAT MESSAGE TYPES
// ============================================================================

export type ChatMessageType = 'text' | 'image' | 'file' | 'system' | 'announcement';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  messageType: ChatMessageType;
  replyToId?: string;
  threadId?: string;
  isEdited: boolean;
  editedAt?: string;
  originalContent?: string;
  isDeleted: boolean;
  attachments?: ChatAttachment[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageWithUser extends ChatMessage {
  users?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

// ============================================================================
// CHAT ROOM MEMBER TYPES
// ============================================================================

export type ChatMemberRole = 'admin' | 'moderator' | 'member';

export interface ChatRoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: ChatMemberRole;
  canPost: boolean;
  isMuted: boolean;
  mutedUntil?: string;
  lastReadAt?: string;
  lastReadMessageId?: string;
  joinedAt: string;
}

export interface ChatRoomMemberWithUser extends ChatRoomMember {
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}

// ============================================================================
// CHAT MENTION TYPES
// ============================================================================

export interface ChatMention {
  id: string;
  messageId: string;
  mentionedUserId: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMentionWithDetails extends ChatMention {
  message?: ChatMessageWithUser;
  mentionedUser?: {
    id: string;
    fullName: string;
    email: string;
  };
}

// ============================================================================
// CHAT REACTION TYPES
// ============================================================================

export interface ChatMessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ChatMessageReactionWithUser extends ChatMessageReaction {
  user?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

// Grouped reactions for display
export interface GroupedReaction {
  emoji: string;
  count: number;
  users: Array<{
    id: string;
    fullName: string;
  }>;
  userReacted: boolean; // Did the current user react with this emoji?
}

// ============================================================================
// TYPING INDICATOR TYPES
// ============================================================================

export interface ChatTypingIndicator {
  id: string;
  roomId: string;
  userId: string;
  startedAt: string;
}

export interface ChatTypingIndicatorWithUser extends ChatTypingIndicator {
  user?: {
    id: string;
    fullName: string;
  };
}

// ============================================================================
// CHAT PRESENCE TYPES
// ============================================================================

export type UserPresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  status: UserPresenceStatus;
  lastSeenAt: string;
  currentRoomId?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Create Room
export interface CreateChatRoomRequest {
  name: string;
  slug?: string;
  description?: string;
  type: ChatRoomType;
  isPrivate?: boolean;
  icon?: string;
  color?: string;
  participantIds?: string[];
}

export interface CreateChatRoomResponse {
  room: ChatRoom;
}

// Send Message
export interface SendMessageRequest {
  room_id: string;
  content: string;
  reply_to?: string;
  message_type?: ChatMessageType;
  attachments?: ChatAttachment[];
}

export interface SendMessageResponse {
  message: ChatMessageWithUser;
}

// Get Messages
export interface GetMessagesRequest {
  room_id: string;
  limit?: number;
  before?: string; // Timestamp for pagination
}

export interface GetMessagesResponse {
  messages: ChatMessageWithUser[];
  has_more: boolean;
}

// Update Message
export interface UpdateMessageRequest {
  content: string;
}

export interface UpdateMessageResponse {
  message: ChatMessageWithUser;
}

// Add Reaction
export interface AddReactionRequest {
  emoji: string;
}

export interface AddReactionResponse {
  reaction: ChatMessageReaction;
}

// Get Rooms
export interface GetRoomsResponse {
  rooms: ChatRoomWithCreator[];
}

// Search Messages
export interface SearchMessagesRequest {
  query: string;
  room_id?: string;
  limit?: number;
}

export interface SearchMessagesResponse {
  messages: ChatMessageWithUser[];
  total: number;
}

// Upload File
export interface UploadFileRequest {
  file: File;
  room_id: string;
}

export interface UploadFileResponse {
  attachment: ChatAttachment;
}

// ============================================================================
// REAL-TIME EVENT TYPES
// ============================================================================

export type ChatEventType =
  | 'message.new'
  | 'message.updated'
  | 'message.deleted'
  | 'reaction.added'
  | 'reaction.removed'
  | 'typing.started'
  | 'typing.stopped'
  | 'user.joined'
  | 'user.left'
  | 'room.updated';

export interface ChatEvent<T = unknown> {
  type: ChatEventType;
  roomId: string;
  userId: string;
  timestamp: string;
  data: T;
}

export interface NewMessageEvent extends ChatEvent<ChatMessageWithUser> {
  type: 'message.new';
}

export interface MessageUpdatedEvent extends ChatEvent<ChatMessageWithUser> {
  type: 'message.updated';
}

export interface MessageDeletedEvent extends ChatEvent<{ messageId: string }> {
  type: 'message.deleted';
}

export interface ReactionAddedEvent extends ChatEvent<ChatMessageReaction> {
  type: 'reaction.added';
}

export interface TypingEvent extends ChatEvent<{ fullName: string }> {
  type: 'typing.started' | 'typing.stopped';
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract user mention strings from message content
 * Matches @username or @"First Last" patterns
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

/**
 * Check if a message is a reply to another message
 */
export function isReply(message: ChatMessage): boolean {
  return !!message.replyToId;
}

/**
 * Check if a message is part of a thread
 */
export function isThreadMessage(message: ChatMessage): boolean {
  return !!message.threadId;
}

/**
 * Check if a message has been edited
 */
export function isEdited(message: ChatMessage): boolean {
  return message.isEdited;
}

/**
 * Check if a message has attachments
 */
export function hasAttachments(message: ChatMessage): boolean {
  return (message.attachments?.length ?? 0) > 0;
}
