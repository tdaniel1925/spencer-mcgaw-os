"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Search,
  MoreVertical,
  Archive,
  Star,
  User,
  Phone,
  Clock,
  CheckCheck,
  Check,
  AlertCircle,
  FileText,
  Plus,
  RefreshCw,
  Users,
  Building,
  Sparkles,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from "date-fns";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  is_primary?: boolean;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Conversation {
  id: string;
  contact_id: string;
  client_id: string;
  phone_number: string;
  status: string;
  is_opted_in: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to: string | null;
  is_priority: boolean;
  is_archived: boolean;
  contact: Contact;
  client: Client;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string;
  media_urls?: string[];
  status: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
}

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
}

function SMSPageContent() {
  const searchParams = useSearchParams();
  const conversationIdFromUrl = searchParams.get("conversation");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState<"all" | "unread" | "priority" | "archived">("all");

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<(Contact & { client: Client })[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (conversationFilter === "unread") {
        params.set("unread_only", "true");
      } else if (conversationFilter === "archived") {
        params.set("status", "archived");
      }

      const res = await fetch(`/api/sms/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        let filtered = data.conversations || [];

        if (conversationFilter === "priority") {
          filtered = filtered.filter((c: Conversation) => c.is_priority);
        }

        setConversations(filtered);
        setTotalUnread(data.totalUnread || 0);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationFilter]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/sms/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setSelectedConversation(data.conversation);
        // Refresh conversations to update unread count
        loadConversations();
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, [loadConversations]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }, []);

  // Load canned responses
  const loadCannedResponses = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/canned-responses");
      if (res.ok) {
        const data = await res.json();
        setCannedResponses(data.responses || []);
      }
    } catch (error) {
      console.error("Error loading canned responses:", error);
    }
  }, []);

  // Load contacts for new conversation
  const loadContacts = useCallback(async () => {
    try {
      // Get all contacts with their clients
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setAvailableContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadTemplates();
    loadCannedResponses();
  }, [loadConversations, loadTemplates, loadCannedResponses]);

  // Auto-select conversation from URL parameter
  useEffect(() => {
    if (conversationIdFromUrl && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => c.id === conversationIdFromUrl);
      if (conversation) {
        loadMessages(conversation.id);
      }
    }
  }, [conversationIdFromUrl, conversations, selectedConversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle canned response shortcuts in input
  useEffect(() => {
    if (messageInput.startsWith("/") && !messageInput.includes(" ")) {
      const shortcut = messageInput.toLowerCase();
      const response = cannedResponses.find(r => r.shortcut.toLowerCase() === shortcut);
      if (response) {
        setMessageInput(response.body);
      }
    }
  }, [messageInput, cannedResponses]);

  // Send message
  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim() || sending) return;

    if (!selectedConversation.is_opted_in) {
      toast.error("Contact has opted out of SMS messages");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/sms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          body: messageInput.trim(),
        }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages(prev => [...prev, newMessage]);
        setMessageInput("");
        inputRef.current?.focus();
        loadConversations();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Create new conversation
  const handleCreateConversation = async () => {
    if (!selectedContact) {
      toast.error("Please select a contact");
      return;
    }

    try {
      const res = await fetch("/api/sms/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: selectedContact }),
      });

      if (res.ok) {
        const conversation = await res.json();
        setShowNewConversation(false);
        setSelectedContact("");
        loadConversations();
        loadMessages(conversation.id);
        toast.success("Conversation started");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create conversation");
      }
    } catch (error) {
      toast.error("Failed to create conversation");
    }
  };

  // Use template
  const handleUseTemplate = (template: Template) => {
    let body = template.body;

    // Replace variables with contact data if available
    if (selectedConversation?.contact) {
      body = body.replace(/\{\{first_name\}\}/g, selectedConversation.contact.first_name);
      body = body.replace(/\{\{last_name\}\}/g, selectedConversation.contact.last_name);
    }

    setMessageInput(body);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  // Toggle priority
  const handleTogglePriority = async (conversation: Conversation) => {
    try {
      const res = await fetch(`/api/sms/conversations/${conversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_priority: !conversation.is_priority }),
      });

      if (res.ok) {
        loadConversations();
        if (selectedConversation?.id === conversation.id) {
          setSelectedConversation({ ...selectedConversation, is_priority: !conversation.is_priority });
        }
      }
    } catch (error) {
      toast.error("Failed to update conversation");
    }
  };

  // Archive conversation
  const handleArchive = async (conversation: Conversation) => {
    try {
      const res = await fetch(`/api/sms/conversations/${conversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !conversation.is_archived }),
      });

      if (res.ok) {
        loadConversations();
        if (selectedConversation?.id === conversation.id) {
          setSelectedConversation(null);
          setMessages([]);
        }
        toast.success(conversation.is_archived ? "Conversation unarchived" : "Conversation archived");
      }
    } catch (error) {
      toast.error("Failed to archive conversation");
    }
  };

  // Format message time
  const formatMessageTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d, h:mm a");
  };

  // Get message status icon
  const getStatusIcon = (message: Message) => {
    if (message.direction === "inbound") return null;

    switch (message.status) {
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      default:
        return null;
    }
  };

  // Filter contacts for search
  const filteredContacts = availableContacts.filter(contact => {
    const search = contactSearch.toLowerCase();
    const hasPhone = contact.phone || contact.mobile;
    return hasPhone && (
      contact.first_name.toLowerCase().includes(search) ||
      contact.last_name.toLowerCase().includes(search) ||
      contact.client?.name.toLowerCase().includes(search) ||
      contact.phone?.includes(search) ||
      contact.mobile?.includes(search)
    );
  });

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      conv.contact.first_name.toLowerCase().includes(search) ||
      conv.contact.last_name.toLowerCase().includes(search) ||
      conv.client.name.toLowerCase().includes(search) ||
      conv.phone_number.includes(search) ||
      conv.last_message_preview?.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <Header title="SMS Messages" />

      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="font-medium">SMS Messages</span>
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm">
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {totalUnread} unread
              </Badge>
            )}
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{filteredConversations.length} conversations</span>
            </div>
          </div>

          <div className="h-4 border-l mx-2" />

          <Button size="sm" className="h-8" onClick={() => { loadContacts(); setShowNewConversation(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Message
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Conversations List */}
          <div className="w-80 border-r flex flex-col bg-muted/20">
            {/* Search Header */}
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-9 h-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Tabs value={conversationFilter} onValueChange={(v) => setConversationFilter(v as typeof conversationFilter)}>
                <TabsList className="w-full grid grid-cols-4 h-7">
                  <TabsTrigger value="all" className="text-[10px]">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-[10px]">Unread</TabsTrigger>
                  <TabsTrigger value="priority" className="text-[10px]">Priority</TabsTrigger>
                  <TabsTrigger value="archived" className="text-[10px]">Archived</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadMessages(conv.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors",
                      "hover:bg-muted/50",
                      selectedConversation?.id === conv.id && "bg-muted",
                      conv.unread_count > 0 && "font-medium"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {conv.contact.first_name[0]}{conv.contact.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {!conv.is_opted_in && (
                          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-background rounded-full">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {conv.contact.first_name} {conv.contact.last_name}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {conv.is_priority && (
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            )}
                            {conv.unread_count > 0 && (
                              <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.client.name}
                        </p>
                        {conv.last_message_preview && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        )}
                        {conv.last_message_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(parseISO(conv.last_message_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-muted/30">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-background flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedConversation.contact.first_name[0]}
                      {selectedConversation.contact.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">
                        {selectedConversation.contact.first_name} {selectedConversation.contact.last_name}
                      </h3>
                      {!selectedConversation.is_opted_in && (
                        <Badge variant="destructive" className="text-[10px]">Opted Out</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-3 w-3" />
                      <span>{selectedConversation.client.name}</span>
                      <span>•</span>
                      <Phone className="h-3 w-3" />
                      <span>{selectedConversation.phone_number}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTogglePriority(selectedConversation)}
                  >
                    <Star className={cn(
                      "h-4 w-4",
                      selectedConversation.is_priority && "fill-yellow-400 text-yellow-400"
                    )} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`/clients/${selectedConversation.client_id}`, "_blank")}>
                        <User className="h-4 w-4 mr-2" />
                        View Client
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleArchive(selectedConversation)}>
                        <Archive className="h-4 w-4 mr-2" />
                        {selectedConversation.is_archived ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, i) => {
                      const isOutbound = message.direction === "outbound";
                      const showDate = i === 0 || (
                        new Date(message.created_at).toDateString() !==
                        new Date(messages[i - 1].created_at).toDateString()
                      );

                      return (
                        <div key={message.id}>
                          {showDate && (
                            <div className="flex items-center justify-center my-4">
                              <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full">
                                {isToday(parseISO(message.created_at)) ? "Today" :
                                  isYesterday(parseISO(message.created_at)) ? "Yesterday" :
                                    format(parseISO(message.created_at), "MMMM d, yyyy")}
                              </span>
                            </div>
                          )}
                          <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[70%] rounded-2xl px-4 py-2",
                              isOutbound
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-background border rounded-bl-md"
                            )}>
                              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                              <div className={cn(
                                "flex items-center gap-1 mt-1",
                                isOutbound ? "justify-end" : "justify-start"
                              )}>
                                <span className={cn(
                                  "text-[10px]",
                                  isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}>
                                  {formatMessageTime(message.created_at)}
                                </span>
                                {getStatusIcon(message)}
                              </div>
                              {message.status === "failed" && message.error_message && (
                                <p className="text-[10px] text-red-300 mt-1">{message.error_message}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 bg-background border-t">
                {!selectedConversation.is_opted_in ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>This contact has opted out of SMS messages</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <Popover open={showTemplates} onOpenChange={setShowTemplates}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="flex-shrink-0">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80 p-0">
                        <div className="p-3 border-b">
                          <h4 className="font-medium">Message Templates</h4>
                        </div>
                        <ScrollArea className="max-h-64">
                          <div className="p-2">
                            {templates.map(template => (
                              <button
                                key={template.id}
                                onClick={() => handleUseTemplate(template)}
                                className="w-full p-2 text-left rounded-lg hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{template.name}</span>
                                  <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {template.body}
                                </p>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <div className="flex-1 relative">
                      <Textarea
                        ref={inputRef}
                        placeholder="Type a message... (Type / for quick replies)"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value.slice(0, 160))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        maxLength={160}
                        className="min-h-[44px] max-h-32 resize-none pr-16"
                        rows={1}
                      />
                      <div className={cn(
                        "absolute bottom-1 right-1 text-[10px]",
                        messageInput.length >= 160 ? "text-red-500 font-medium" :
                        messageInput.length >= 140 ? "text-amber-500" :
                        "text-muted-foreground"
                      )}>
                        {messageInput.length}/160
                      </div>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sending || messageInput.length > 160}
                      className="flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-lg">Select a conversation</h3>
                <p className="text-sm">Choose a conversation from the list or start a new one</p>
                <Button
                  className="mt-4"
                  onClick={() => { loadContacts(); setShowNewConversation(true); }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Conversation
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Select a contact to start a new SMS conversation. Only contacts with phone numbers are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-9"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2">
                {filteredContacts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No contacts with phone numbers found</p>
                  </div>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedContact(contact.id)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left transition-colors",
                        "hover:bg-muted/50",
                        selectedContact === contact.id && "bg-primary/10 border border-primary"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {contact.first_name[0]}{contact.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.client?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.mobile || contact.phone}
                          </p>
                        </div>
                        {selectedContact === contact.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConversation(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} disabled={!selectedContact}>
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SMSPage() {
  return (
    <Suspense fallback={
      <>
        <Header title="SMS Messages" />
        <main className="flex-1 overflow-hidden flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      </>
    }>
      <SMSPageContent />
    </Suspense>
  );
}
