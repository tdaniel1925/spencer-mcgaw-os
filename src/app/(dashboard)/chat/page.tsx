"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  MoreHorizontal,
  Edit2,
  Trash2,
  Smile,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  AtSign,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat, type PresenceStatus } from "@/lib/chat";
import { useAuth } from "@/lib/supabase/auth-context";
import { format, isToday, isYesterday } from "date-fns";

// Common emoji reactions
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

// Presence indicator component
function PresenceIndicator({ status, size = "sm" }: { status?: PresenceStatus; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const statusColors: Record<PresenceStatus, string> = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    busy: "bg-red-500",
    offline: "bg-gray-400"
  };

  return (
    <span className={cn(
      "rounded-full border-2 border-background absolute bottom-0 right-0",
      sizeClass,
      statusColors[status || "offline"]
    )} />
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const {
    rooms,
    currentRoom,
    messages,
    typingUsers,
    presence,
    loading,
    loadingMessages,
    setCurrentRoom,
    sendMessage,
    startDM,
    setTyping,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    getUserPresence,
    createChannel,
  } = useChat();

  const [messageInput, setMessageInput] = useState("");
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!messageInput.trim() && attachments.length === 0) return;

    // Include attachment URLs in the message if any
    let content = messageInput.trim();
    if (attachments.length > 0) {
      const attachmentText = attachments.map(a => `[${a.name}](${a.url})`).join("\n");
      content = content ? `${content}\n\n${attachmentText}` : attachmentText;
    }

    await sendMessage(content);
    setMessageInput("");
    setAttachments([]);
    setShowMentions(false);
  };

  // Handle input change with typing indicator and @mention detection
  const handleInputChange = (value: string) => {
    setMessageInput(value);
    setTyping(value.length > 0);

    // Detect @mention
    const cursorPos = inputRef.current?.selectionStart || 0;
    setCursorPosition(cursorPos);

    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionFilter(mentionMatch[1]);
      setShowMentions(true);
      if (users.length === 0) {
        loadUsers();
      }
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention into input
  const insertMention = (userName: string) => {
    const textBeforeCursor = messageInput.slice(0, cursorPosition);
    const textAfterCursor = messageInput.slice(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const newText = textBeforeCursor.slice(0, -mentionMatch[0].length) +
        `@${userName} ` +
        textAfterCursor;
      setMessageInput(newText);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentRoom) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("room_id", currentRoom.id);

        const response = await fetch("/api/chat/upload", {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          setAttachments(prev => [...prev, data]);
        } else {
          console.error("Upload failed");
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle message search
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`/api/chat/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.messages || []);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Handle creating a channel
  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;

    const room = await createChannel(channelName.trim(), channelDescription.trim(), channelPrivate);
    if (room) {
      setShowNewChannel(false);
      setChannelName("");
      setChannelDescription("");
      setChannelPrivate(false);
    }
  };

  // Handle editing a message
  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    await editMessage(editingMessage, editContent.trim());
    setEditingMessage(null);
    setEditContent("");
  };

  // Handle deleting a message
  const handleDeleteMessage = async (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      await deleteMessage(messageId);
    }
  };

  // Handle reaction toggle
  const handleReaction = async (messageId: string, emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      await removeReaction(messageId, emoji);
    } else {
      await addReaction(messageId, emoji);
    }
  };

  // Get filtered users for mention
  const filteredUsers = users.filter(u =>
    u.id !== user?.id &&
    (u.full_name?.toLowerCase().includes(mentionFilter.toLowerCase()) ||
     u.email.toLowerCase().includes(mentionFilter.toLowerCase()))
  );

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
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="font-medium">Team Chat</span>
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{rooms.length} conversations</span>
            </div>
          </div>

          <div className="h-4 border-l mx-2" />

          {/* Search Button */}
          <Dialog open={showSearch} onOpenChange={setShowSearch}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Search className="h-4 w-4 mr-1.5" />
                Search
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Search Messages</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <ScrollArea className="max-h-80">
                {searchLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => {
                          const room = rooms.find(r => r.id === msg.room_id);
                          if (room) {
                            setCurrentRoom(room);
                            setShowSearch(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {msg.users?.full_name || msg.users?.email}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            in {msg.chat_rooms?.name || "DM"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <p className="text-center text-muted-foreground py-4">No messages found</p>
                ) : null}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* New Channel Button */}
          <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Hash className="h-4 w-4 mr-1.5" />
                New Channel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Channel</DialogTitle>
                <DialogDescription>
                  Create a new channel for team discussions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="channel-name">Channel Name</Label>
                  <Input
                    id="channel-name"
                    placeholder="general-discussion"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="channel-desc">Description (optional)</Label>
                  <Textarea
                    id="channel-desc"
                    placeholder="What is this channel about?"
                    value={channelDescription}
                    onChange={(e) => setChannelDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="channel-private">Private Channel</Label>
                    <p className="text-xs text-muted-foreground">Only invited members can join</p>
                  </div>
                  <Switch
                    id="channel-private"
                    checked={channelPrivate}
                    onCheckedChange={setChannelPrivate}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewChannel(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateChannel} disabled={!channelName.trim()}>
                  Create Channel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New DM Button */}
          <Dialog open={showNewDM} onOpenChange={setShowNewDM}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  setShowNewDM(true);
                  loadUsers();
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Message
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
                    {users.map((u) => {
                      const userPresence = getUserPresence(u.id);
                      return (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => handleStartDM(u.id)}
                          className="cursor-pointer"
                        >
                          <div className="relative mr-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(u.full_name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <PresenceIndicator status={userPresence?.status} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">{u.full_name || "Unnamed"}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Room List */}
          <div className="w-72 border-r flex flex-col bg-muted/20">
            {/* Sidebar Header */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  className="h-8 pl-9 text-sm"
                />
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
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={room.other_user.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(room.other_user.full_name, room.other_user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceIndicator status={getUserPresence(room.other_user.id)?.status} size="md" />
                      </div>
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
                          {room.last_message.users?.full_name?.split(" ")[0] || "User"}:{" "}
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
        <div className="flex-1 flex flex-col bg-background">
          {currentRoom ? (
            <>
              {/* Chat Header */}
              <div className="h-12 border-b px-4 flex items-center gap-3 bg-card/50">
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
                          const reactions = msg.reactions || [];
                          const groupedReactions = reactions.reduce((acc: Record<string, { count: number; users: string[]; hasOwn: boolean }>, r: any) => {
                            if (!acc[r.emoji]) {
                              acc[r.emoji] = { count: 0, users: [], hasOwn: false };
                            }
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.user?.full_name || r.user?.email || "User");
                            if (r.user_id === user?.id) acc[r.emoji].hasOwn = true;
                            return acc;
                          }, {});

                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex gap-2 group",
                                isOwn ? "flex-row-reverse" : "flex-row",
                                !showAvatar && !isOwn && "pl-10"
                              )}
                            >
                              {showAvatar && !isOwn && (
                                <Avatar className="h-8 w-8 mt-0.5">
                                  <AvatarImage src={msg.users?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(msg.users?.full_name || null, msg.users?.email || "")}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={cn("max-w-[70%] relative", isOwn && "text-right")}>
                                {showAvatar && !isOwn && (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {msg.users?.full_name || msg.users?.email}
                                  </span>
                                )}
                                <div className="relative inline-block">
                                  {/* Message actions (visible on hover) */}
                                  <div className={cn(
                                    "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border rounded-md shadow-sm p-0.5",
                                    isOwn ? "left-0 -translate-x-full -ml-2" : "right-0 translate-x-full mr-2"
                                  )}>
                                    {/* Reaction picker */}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <Smile className="h-3.5 w-3.5" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-2" align="center">
                                        <div className="flex gap-1">
                                          {QUICK_REACTIONS.map(emoji => (
                                            <button
                                              key={emoji}
                                              onClick={() => handleReaction(msg.id, emoji, groupedReactions[emoji]?.hasOwn || false)}
                                              className="text-lg hover:bg-muted p-1 rounded transition-colors"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>

                                    {/* Edit/Delete for own messages */}
                                    {isOwn && !msg.is_deleted && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => {
                                            setEditingMessage(msg.id);
                                            setEditContent(msg.content);
                                          }}>
                                            <Edit2 className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => handleDeleteMessage(msg.id)}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>

                                  {/* Message content */}
                                  {editingMessage === msg.id ? (
                                    <div className="flex flex-col gap-2">
                                      <Textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-w-[200px]"
                                        rows={2}
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingMessage(null);
                                            setEditContent("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleEditMessage}>
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "rounded-2xl px-3 py-2 text-sm",
                                        msg.is_deleted
                                          ? "bg-muted/50 text-muted-foreground italic"
                                          : isOwn
                                            ? "bg-primary text-primary-foreground rounded-br-sm"
                                            : "bg-muted rounded-bl-sm"
                                      )}
                                    >
                                      {msg.content}
                                    </div>
                                  )}
                                </div>

                                {/* Reactions display */}
                                {Object.keys(groupedReactions).length > 0 && (
                                  <div className={cn("flex gap-1 mt-1 flex-wrap", isOwn && "justify-end")}>
                                    {(Object.entries(groupedReactions) as [string, { count: number; users: string[]; hasOwn: boolean }][]).map(([emoji, data]) => (
                                      <TooltipProvider key={emoji}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => handleReaction(msg.id, emoji, data.hasOwn)}
                                              className={cn(
                                                "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-colors",
                                                data.hasOwn
                                                  ? "bg-primary/10 border-primary/30"
                                                  : "bg-muted border-transparent hover:border-muted-foreground/30"
                                              )}
                                            >
                                              <span>{emoji}</span>
                                              <span className="text-muted-foreground">{data.count}</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">{data.users.join(", ")}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                  </div>
                                )}

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
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                        {att.type.startsWith("image/") ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="max-w-[150px] truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* @Mentions Popup */}
                {showMentions && filteredUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredUsers.slice(0, 5).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => insertMention(u.full_name || u.email.split("@")[0])}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(u.full_name, u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium">{u.full_name || u.email.split("@")[0]}</span>
                          <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  {/* File Upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Message Input with relative positioning for mentions */}
                  <div className="flex-1 relative">
                    <Textarea
                      ref={inputRef}
                      value={messageInput}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Message ${getRoomName(currentRoom)}... (@ to mention)`}
                      className="min-h-[40px] max-h-[120px] resize-none"
                      rows={1}
                    />
                  </div>

                  <Button type="submit" size="icon" disabled={!messageInput.trim() && attachments.length === 0}>
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
        </div>
      </main>
    </>
  );
}
