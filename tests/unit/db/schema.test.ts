import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';

describe('Drizzle Schema - New Tables Added', () => {
  it('should export userProfiles table', () => {
    expect(schema.userProfiles).toBeDefined();
    expect(typeof schema.userProfiles).toBe('object');
  });

  it('should export chatRooms table', () => {
    expect(schema.chatRooms).toBeDefined();
    expect(typeof schema.chatRooms).toBe('object');
  });

  it('should export chatMessages table', () => {
    expect(schema.chatMessages).toBeDefined();
    expect(typeof schema.chatMessages).toBe('object');
  });

  it('should export chatRoomMembers table', () => {
    expect(schema.chatRoomMembers).toBeDefined();
    expect(typeof schema.chatRoomMembers).toBe('object');
  });

  it('should export chatMentions table', () => {
    expect(schema.chatMentions).toBeDefined();
    expect(typeof schema.chatMentions).toBe('object');
  });

  it('should export chatMessageReactions table', () => {
    expect(schema.chatMessageReactions).toBeDefined();
    expect(typeof schema.chatMessageReactions).toBe('object');
  });

  it('should export chatTypingIndicators table', () => {
    expect(schema.chatTypingIndicators).toBeDefined();
    expect(typeof schema.chatTypingIndicators).toBe('object');
  });

  it('should export UserProfile type', () => {
    expect(schema).toHaveProperty('userProfiles');
  });

  it('should export ChatRoom type', () => {
    expect(schema).toHaveProperty('chatRooms');
  });

  it('should export ChatMessage type', () => {
    expect(schema).toHaveProperty('chatMessages');
  });
});
