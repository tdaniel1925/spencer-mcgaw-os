"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";

interface User {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: string;
  reply_to: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  profiles: User | null;
}

interface Room {
  id: string;
  name: string | null;
  type: "community" | "private" | "group";
  description: string | null;
  created_by: string;
  created_at: string;
  last_message: Message | null;
  unread_count: number;
  other_user?: User | null;
}

interface TypingUser {
  user_id: string;
  user: User;
}

interface ChatContextType {
  rooms: Room[];
  currentRoom: Room | null;
  messages: Message[];
  typingUsers: TypingUser[];
  loading: boolean;
  loadingMessages: boolean;
  totalUnread: number;
  setCurrentRoom: (room: Room | null) => void;
  sendMessage: (content: string) => Promise<void>;
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  startDM: (userId: string) => Promise<Room | null>;
  setTyping: (isTyping: boolean) => void;
  markAsRead: (roomId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<boolean>(false);
  const supabase = createClient();

  // Calculate total unread
  const totalUnread = rooms.reduce((sum, room) => sum + room.unread_count, 0);

  // Load rooms
  const loadRooms = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/chat/rooms");
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load messages for a room
  const loadMessages = useCallback(async (roomId: string) => {
    if (!user) return;

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/chat/messages?room_id=${roomId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !currentRoom || !content.trim()) return;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: currentRoom.id,
          content: content.trim()
        })
      });

      if (response.ok) {
        // Clear typing indicator
        setTyping(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [user, currentRoom]);

  // Start a DM with a user
  const startDM = useCallback(async (userId: string): Promise<Room | null> => {
    if (!user) return null;

    try {
      const response = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "private",
          participant_id: userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        await loadRooms();
        return data.room;
      }
    } catch (error) {
      console.error("Error starting DM:", error);
    }
    return null;
  }, [user, loadRooms]);

  // Set typing indicator
  const setTyping = useCallback((isTyping: boolean) => {
    if (!user || !currentRoom) return;

    // Debounce typing indicator updates
    if (isTyping === lastTypingRef.current) return;
    lastTypingRef.current = isTyping;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing update
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: currentRoom.id,
        is_typing: isTyping
      })
    }).catch(console.error);

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        lastTypingRef.current = false;
        fetch("/api/chat/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: currentRoom.id,
            is_typing: false
          })
        }).catch(console.error);
      }, 3000);
    }
  }, [user, currentRoom]);

  // Mark room as read
  const markAsRead = useCallback((roomId: string) => {
    setRooms(prev => prev.map(room =>
      room.id === roomId ? { ...room, unread_count: 0 } : room
    ));
  }, []);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel("chat_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages"
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Fetch the full message with user info
          const { data: fullMessage } = await supabase
            .from("chat_messages")
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                email,
                avatar_url
              )
            `)
            .eq("id", newMessage.id)
            .single();

          if (fullMessage) {
            // Add to current room's messages if viewing that room
            if (currentRoom?.id === fullMessage.room_id) {
              setMessages(prev => [...prev, fullMessage]);
              markAsRead(fullMessage.room_id);
            } else {
              // Increment unread count for other rooms
              setRooms(prev => prev.map(room =>
                room.id === fullMessage.room_id
                  ? {
                      ...room,
                      unread_count: room.unread_count + (fullMessage.user_id !== user.id ? 1 : 0),
                      last_message: fullMessage
                    }
                  : room
              ));
            }
          }
        }
      )
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel("chat_typing_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_typing_indicators"
        },
        async (payload) => {
          if (!currentRoom) return;

          const record = (payload.new || payload.old) as any;
          if (record.room_id !== currentRoom.id) return;
          if (record.user_id === user.id) return;

          if (payload.eventType === "DELETE") {
            setTypingUsers(prev => prev.filter(t => t.user_id !== record.user_id));
          } else {
            // Fetch user info
            const { data: userProfile } = await supabase
              .from("profiles")
              .select("id, full_name, email, avatar_url")
              .eq("id", record.user_id)
              .single();

            if (userProfile) {
              setTypingUsers(prev => {
                const existing = prev.find(t => t.user_id === record.user_id);
                if (existing) return prev;
                return [...prev, { user_id: record.user_id, user: userProfile }];
              });

              // Auto-remove after 5 seconds if not updated
              setTimeout(() => {
                setTypingUsers(prev => prev.filter(t => t.user_id !== record.user_id));
              }, 5000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [user, currentRoom, supabase, markAsRead]);

  // Load rooms on mount
  useEffect(() => {
    if (user) {
      loadRooms();
    }
  }, [user, loadRooms]);

  // Load messages when room changes
  useEffect(() => {
    if (currentRoom) {
      loadMessages(currentRoom.id);
      markAsRead(currentRoom.id);
      setTypingUsers([]);
    }
  }, [currentRoom, loadMessages, markAsRead]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        currentRoom,
        messages,
        typingUsers,
        loading,
        loadingMessages,
        totalUnread,
        setCurrentRoom,
        sendMessage,
        loadRooms,
        loadMessages,
        startDM,
        setTyping,
        markAsRead
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
