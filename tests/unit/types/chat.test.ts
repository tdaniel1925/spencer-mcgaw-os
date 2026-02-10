import { describe, it, expect } from 'vitest';
import {
  extractMentions,
  isReply,
  isThreadMessage,
  isEdited,
  hasAttachments,
  type ChatMessage,
  type ChatRoomType,
  type ChatMessageType,
} from '@/types/chat';

describe('Chat Type Utilities', () => {
  describe('extractMentions', () => {
    it('should extract single mention', () => {
      const content = 'Hey @john, can you help?';
      const mentions = extractMentions(content);
      expect(mentions).toEqual(['john']);
    });

    it('should extract multiple mentions', () => {
      const content = '@alice and @bob, please review this @charlie';
      const mentions = extractMentions(content);
      expect(mentions).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should extract mentions (single words only)', () => {
      const content = 'Ping @John for approval';
      const mentions = extractMentions(content);
      expect(mentions).toContain('John');
    });

    it('should return empty array for no mentions', () => {
      const content = 'Just a regular message';
      const mentions = extractMentions(content);
      expect(mentions).toEqual([]);
    });
  });

  describe('isReply', () => {
    it('should return true for reply messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Reply',
        messageType: 'text',
        replyToId: 'msg-123',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isReply(message)).toBe(true);
    });

    it('should return false for non-reply messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Regular message',
        messageType: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isReply(message)).toBe(false);
    });
  });

  describe('isThreadMessage', () => {
    it('should return true for thread messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Thread reply',
        messageType: 'text',
        threadId: 'thread-1',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isThreadMessage(message)).toBe(true);
    });

    it('should return false for non-thread messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Regular message',
        messageType: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isThreadMessage(message)).toBe(false);
    });
  });

  describe('isEdited', () => {
    it('should return true for edited messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Edited content',
        messageType: 'text',
        isEdited: true,
        editedAt: new Date().toISOString(),
        originalContent: 'Original content',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isEdited(message)).toBe(true);
    });

    it('should return false for non-edited messages', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Original content',
        messageType: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isEdited(message)).toBe(false);
    });
  });

  describe('hasAttachments', () => {
    it('should return true when attachments exist', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Check this file',
        messageType: 'file',
        attachments: [
          { id: '1', name: 'doc.pdf', type: 'application/pdf', size: 1024, url: 'https://example.com/doc.pdf' }
        ],
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(hasAttachments(message)).toBe(true);
    });

    it('should return false when no attachments', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Regular message',
        messageType: 'text',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(hasAttachments(message)).toBe(false);
    });

    it('should return false for empty attachments array', () => {
      const message: ChatMessage = {
        id: '1',
        roomId: 'room1',
        userId: 'user1',
        content: 'Message',
        messageType: 'text',
        attachments: [],
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(hasAttachments(message)).toBe(false);
    });
  });

  describe('Type Definitions', () => {
    it('should allow valid ChatRoomType values', () => {
      const types: ChatRoomType[] = ['community', 'team', 'direct', 'private'];
      expect(types).toHaveLength(4);
    });

    it('should allow valid ChatMessageType values', () => {
      const types: ChatMessageType[] = ['text', 'image', 'file', 'system', 'announcement'];
      expect(types).toHaveLength(5);
    });
  });
});
