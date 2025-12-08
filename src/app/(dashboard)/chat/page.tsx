"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  MessageSquare,
  Send,
  Users,
  Hash,
  Plus,
  Search,
  Loader2,
  User,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/lib/chat";
import { useAuth } from "@/lib/supabase/auth-context";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

export default function ChatPage() {
  const { user } = useAuth();
  const {
    rooms,
    currentRoom,
    messages,
    typingUsers,
    loading,
    loadingMessages,
    setCurrentRoom,
    sendMessage,
    startDM,
    setTyping,
  } = useChat();

  const [messageInput, setMessageInput] = useState("");
  const [showNewDM, setShowNewDM] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when room changes
  useEffect(() => {
    if (currentRoom) {
      inputRef.current?.focus();
    }
  }, [currentRoom]);

  // Load users for DM picker
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users?.filter((u: any) => u.id !== user?.id) || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle sending message
  const handleSend = async () => {
    if (!messageInput.trim()) return;
    await sendMessage(messageInput);
    setMessageInput("");
  };

  // Handle input change with typing indicator
  const handleInputChange = (value: string) => {
    setMessageInput(value);
    setTyping(value.length > 0);
  };

  // Handle starting a new DM
  const handleStartDM = async (userId: string) => {
    const room = await startDM(userId);
    if (room) {
      setShowNewDM(false);
      // Find the room in the list and set it as current
      const fullRoom = rooms.find(r => r.id === room.id);
      if (fullRoom) {
        setCurrentRoom(fullRoom);
      }
    }
  };

  // Format message timestamp
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d, h:mm a");
  };

  // Get user initials
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  // Get room display name
  const getRoomName = (room: any) => {
    if (room.type === "private" && room.other_user) {
      return room.other_user.full_name || room.other_user.email;
    }
    return room.name || "Unnamed Room";
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: any[]) => {
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = "";

    msgs.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  };

  // Format date divider
  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  return (
    <>
      <Header title="Chat" />
      <main className="flex h-[calc(100vh-65px)]">
        {/* Sidebar - Room List */}
        <div className="w-72 border-r flex flex-col bg-muted/30">
          {/* Sidebar Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Messages</h2>
              <Dialog open={showNewDM} onOpenChange={setShowNewDM}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setShowNewDM(true);
                      loadUsers();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Message</DialogTitle>
                  </DialogHeader>
                  <Command className="rounded-lg border">
                    <CommandInput placeholder="Search users..." />
                    <CommandList className="max-h-64">
                      <CommandEmpty>
                        {loadingUsers ? "Loading..." : "No users found"}
                      </CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={u.id}
                            onSelect={() => handleStartDM(u.id)}
                            className="cursor-pointer"
                          >
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(u.full_name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{u.full_name || "Unnamed"}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Room List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setCurrentRoom(room)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                      currentRoom?.id === room.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    {/* Avatar */}
                    {room.type === "community" ? (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Hash className="h-5 w-5 text-primary" />
                      </div>
                    ) : room.type === "private" && room.other_user ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={room.other_user.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(room.other_user.full_name, room.other_user.email)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    {/* Room Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {getRoomName(room)}
                        </span>
                        {room.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">
                            {room.unread_count}
                          </Badge>
                        )}
                      </div>
                      {room.last_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {room.last_message.profiles?.full_name?.split(" ")[0] || "User"}:{" "}
                          {room.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {currentRoom ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b px-4 flex items-center gap-3">
                {currentRoom.type === "community" ? (
                  <Hash className="h-5 w-5 text-muted-foreground" />
                ) : currentRoom.type === "private" && currentRoom.other_user ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentRoom.other_user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(currentRoom.other_user.full_name, currentRoom.other_user.email)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Users className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <h3 className="font-semibold">{getRoomName(currentRoom)}</h3>
                  {currentRoom.description && (
                    <p className="text-xs text-muted-foreground">{currentRoom.description}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupMessagesByDate(messages).map((group) => (
                      <div key={group.date}>
                        {/* Date Divider */}
                        <div className="flex items-center gap-2 my-4">
                          <Separator className="flex-1" />
                          <span className="text-xs text-muted-foreground px-2">
                            {formatDateDivider(group.date)}
                          </span>
                          <Separator className="flex-1" />
                        </div>

                        {/* Messages */}
                        {group.messages.map((msg, idx) => {
                          const isOwn = msg.user_id === user?.id;
                          const showAvatar = idx === 0 ||
                            group.messages[idx - 1]?.user_id !== msg.user_id;

                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex gap-2",
                                isOwn ? "flex-row-reverse" : "flex-row",
                                !showAvatar && "pl-10"
                              )}
                            >
                              {showAvatar && !isOwn && (
                                <Avatar className="h-8 w-8 mt-0.5">
                                  <AvatarImage src={msg.profiles?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(msg.profiles?.full_name || null, msg.profiles?.email || "")}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                                {showAvatar && !isOwn && (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {msg.profiles?.full_name || msg.profiles?.email}
                                  </span>
                                )}
                                <div
                                  className={cn(
                                    "rounded-2xl px-3 py-2 text-sm inline-block",
                                    isOwn
                                      ? "bg-primary text-primary-foreground rounded-br-sm"
                                      : "bg-muted rounded-bl-sm"
                                  )}
                                >
                                  {msg.content}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatMessageTime(msg.created_at)}
                                  {msg.is_edited && " (edited)"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
                  {typingUsers.length === 1
                    ? `${typingUsers[0].user.full_name || "Someone"} is typing...`
                    : `${typingUsers.length} people are typing...`}
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={`Message ${getRoomName(currentRoom)}`}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            /* No Room Selected */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Welcome to Chat</h3>
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
