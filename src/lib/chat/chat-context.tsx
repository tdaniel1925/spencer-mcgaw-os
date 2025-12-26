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

export type PresenceStatus = "online" | "away" | "busy" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string;
  current_room_id?: string;
  user?: User;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: User;
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
  edited_at?: string;
  original_content?: string;
  attachments?: { url: string; name: string; type: string; size: number }[];
  created_at: string;
  updated_at: string;
  users: User | null;
  reactions?: MessageReaction[];
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
  presence: Map<string, UserPresence>;
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
  updatePresence: (status: PresenceStatus) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  getUserPresence: (userId: string) => UserPresence | undefined;
  createChannel: (name: string, description?: string, isPrivate?: boolean) => Promise<Room | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<boolean>(false);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // Update own presence
  const updatePresence = useCallback(async (status: PresenceStatus) => {
    if (!user) return;

    try {
      await fetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          current_room_id: currentRoom?.id
        })
      });
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  }, [user, currentRoom]);

  // Get user presence
  const getUserPresence = useCallback((userId: string) => {
    return presence.get(userId);
  }, [presence]);

  // Edit a message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent })
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: newContent, is_edited: true, edited_at: new Date().toISOString() }
            : msg
        ));
      }
    } catch (error) {
      console.error("Error editing message:", error);
    }
  }, [user]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, is_deleted: true, content: "[Message deleted]" }
            : msg
        ));
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }, [user]);

  // Add reaction to message
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji })
      });

      if (response.ok) {
        const { reaction } = await response.json();
        setMessages(prev => prev.map(msg => {
          if (msg.id !== messageId) return msg;
          const reactions = msg.reactions || [];
          return { ...msg, reactions: [...reactions, reaction] };
        }));
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  }, [user]);

  // Remove reaction from message
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg => {
          if (msg.id !== messageId) return msg;
          const reactions = (msg.reactions || []).filter(
            r => !(r.emoji === emoji && r.user_id === user.id)
          );
          return { ...msg, reactions };
        }));
      }
    } catch (error) {
      console.error("Error removing reaction:", error);
    }
  }, [user]);

  // Create a channel (group or community room)
  const createChannel = useCallback(async (name: string, description?: string, isPrivate: boolean = false): Promise<Room | null> => {
    if (!user) return null;

    try {
      const response = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type: isPrivate ? "group" : "community"
        })
      });

      if (response.ok) {
        const { room } = await response.json();
        await loadRooms();
        return room;
      }
    } catch (error) {
      console.error("Error creating channel:", error);
    }
    return null;
  }, [user, loadRooms]);

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
              users:user_id (
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
              .from("user_profiles")
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

    // Subscribe to presence changes
    const presenceChannel = supabase
      .channel("presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence"
        },
        (payload) => {
          const record = payload.new as UserPresence | null;
          if (record) {
            setPresence(prev => {
              const next = new Map(prev);
              next.set(record.user_id, record);
              return next;
            });
          }
        }
      )
      .subscribe();

    // Subscribe to reaction changes
    const reactionsChannel = supabase
      .channel("reaction_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_reactions"
        },
        async (payload) => {
          const record = payload.new as any;
          const oldRecord = payload.old as any;

          if (payload.eventType === "DELETE" && oldRecord) {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== oldRecord.message_id) return msg;
              return {
                ...msg,
                reactions: (msg.reactions || []).filter(r => r.id !== oldRecord.id)
              };
            }));
          } else if (record) {
            // Fetch the reaction with user info
            const { data: reaction } = await supabase
              .from("chat_message_reactions")
              .select(`
                *,
                user:user_id (id, full_name, email, avatar_url)
              `)
              .eq("id", record.id)
              .single();

            if (reaction) {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== reaction.message_id) return msg;
                const existing = (msg.reactions || []).find(r => r.id === reaction.id);
                if (existing) return msg;
                return { ...msg, reactions: [...(msg.reactions || []), reaction] };
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [user, currentRoom, supabase, markAsRead]);

  // Presence heartbeat - update every 60 seconds
  useEffect(() => {
    if (!user) return;

    // Load initial presence for all users
    const loadPresence = async () => {
      try {
        const response = await fetch("/api/chat/presence");
        if (response.ok) {
          const { presence: presenceList } = await response.json();
          const presenceMap = new Map<string, UserPresence>();
          for (const p of presenceList) {
            // Map user_profiles to user for consistency
            const presence: UserPresence = {
              user_id: p.user_id,
              status: p.status,
              last_seen_at: p.last_seen_at,
              current_room_id: p.current_room_id,
              user: p.user_profiles || p.user,
            };
            presenceMap.set(p.user_id, presence);
          }
          setPresence(presenceMap);
        }
      } catch (error) {
        console.error("Error loading presence:", error);
      }
    };

    // Set online when chat opens, then load presence
    const initPresence = async () => {
      await updatePresence("online");
      await loadPresence();
    };
    initPresence();

    // Heartbeat interval - update and refresh presence
    presenceIntervalRef.current = setInterval(async () => {
      await updatePresence("online");
      await loadPresence();
    }, 30000); // Reduced to 30 seconds for better updates

    // Set offline when leaving
    const handleBeforeUnload = () => {
      navigator.sendBeacon("/api/chat/presence", JSON.stringify({ status: "offline" }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Set offline on unmount
      fetch("/api/chat/presence", { method: "DELETE" }).catch(() => {});
    };
  }, [user, updatePresence]);

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
        presence,
        loading,
        loadingMessages,
        totalUnread,
        setCurrentRoom,
        sendMessage,
        loadRooms,
        loadMessages,
        startDM,
        setTyping,
        markAsRead,
        updatePresence,
        editMessage,
        deleteMessage,
        addReaction,
        removeReaction,
        getUserPresence,
        createChannel
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
