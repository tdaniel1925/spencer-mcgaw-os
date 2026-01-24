"use client";

/**
 * Full Email Client
 *
 * Gmail/Outlook-style email interface with:
 * - Folder navigation (inbox, sent, drafts, etc)
 * - Email list with threading
 * - Email viewer with HTML rendering
 * - Compose/reply/forward
 * - Search
 * - Attachments
 * - AI features
 */

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  Inbox,
  Send,
  FileText,
  Archive,
  Trash2,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  Settings,
  Folder,
  Star,
  MoreVertical,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  Clock,
  User,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Header } from "@/components/layout/header";
import { ComposeDialog } from "@/components/email/compose-dialog";

// Types
interface EmailFolder {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  unreadCount: number;
  totalCount: number;
}

interface Email {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: "text" | "html";
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  flag: {
    flagStatus: string;
  };
}

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export default function EmailClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEmailId = searchParams?.get("id");
  const selectedFolder = searchParams?.get("folder") || "inbox";

  // State
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [thread, setThread] = useState<Email[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');
  const [composeReplyTo, setComposeReplyTo] = useState<any>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (node) observerRef.current?.observe(node);
  }, []);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      setIsLoadingFolders(true);
      const response = await fetch("/api/emails/folders");
      const data = await response.json();

      if (data.needsConnection) {
        setNeedsConnection(true);
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setFolders(data.folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // Fetch emails for folder
  const fetchEmails = useCallback(async (folder: string, append = false) => {
    try {
      if (!append) {
        setIsLoadingEmails(true);
        setSkip(0);
      } else {
        setIsLoadingMore(true);
      }

      const currentSkip = append ? skip : 0;
      const response = await fetch(`/api/emails?folder=${folder}&top=50&skip=${currentSkip}`);
      const data = await response.json();

      if (data.needsConnection) {
        setNeedsConnection(true);
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (append) {
        setEmails((prev) => [...prev, ...data.emails]);
      } else {
        setEmails(data.emails);
      }

      // Check if there are more emails to load
      setHasMore(data.emails.length === 50);
      if (append) {
        setSkip((prev) => prev + data.emails.length);
      } else {
        setSkip(data.emails.length);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Failed to load emails");
    } finally {
      setIsLoadingEmails(false);
      setIsLoadingMore(false);
    }
  }, [skip]);

  // Fetch single email
  const fetchEmail = useCallback(async (emailId: string) => {
    try {
      setIsLoadingEmail(true);
      const response = await fetch(`/api/emails/${emailId}`);
      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setSelectedEmail(data.email);

      // Fetch thread
      const threadResponse = await fetch(`/api/emails/${emailId}/thread`);
      const threadData = await threadResponse.json();
      setThread(threadData.thread || []);

      // Fetch attachments if any
      if (data.email.hasAttachments) {
        const attachmentsResponse = await fetch(`/api/emails/${emailId}/attachments`);
        const attachmentsData = await attachmentsResponse.json();
        setAttachments(attachmentsData.attachments || []);
      } else {
        setAttachments([]);
      }
    } catch (error) {
      console.error("Error fetching email:", error);
      toast.error("Failed to load email");
    } finally {
      setIsLoadingEmail(false);
    }
  }, []);

  // Mark as read
  const markAsRead = useCallback(async (emailId: string, isRead: boolean) => {
    try {
      await fetch(`/api/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });

      // Update local state
      setEmails((prev) =>
        prev.map((email) => (email.id === emailId ? { ...email, isRead } : email))
      );
    } catch (error) {
      console.error("Error marking email:", error);
      toast.error("Failed to update email");
    }
  }, []);

  // Delete email
  const deleteEmail = useCallback(async (emailId: string) => {
    try {
      await fetch(`/api/emails/${emailId}`, {
        method: "DELETE",
      });

      toast.success("Email moved to trash");

      // Remove from list
      setEmails((prev) => prev.filter((email) => email.id !== emailId));
      setSelectedEmail(null);
    } catch (error) {
      console.error("Error deleting email:", error);
      toast.error("Failed to delete email");
    }
  }, []);

  // Handle email selection
  const selectEmail = useCallback(
    (email: Email) => {
      router.push(`/email-client?folder=${selectedFolder}&id=${email.id}`);
      if (!email.isRead) {
        markAsRead(email.id, true);
      }
    },
    [selectedFolder, router, markAsRead]
  );

  // Handle folder change
  const changeFolder = useCallback(
    (folder: string) => {
      router.push(`/email-client?folder=${folder}`);
      setSelectedEmail(null);
      setThread([]);
      setAttachments([]);
    },
    [router]
  );

  // Load more emails
  const loadMoreEmails = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoadingEmails) {
      fetchEmails(selectedFolder, true);
    }
  }, [isLoadingMore, hasMore, isLoadingEmails, selectedFolder, fetchEmails]);

  // Handle reply
  const handleReply = useCallback((email: Email, replyAll: boolean = false) => {
    setComposeMode(replyAll ? 'replyAll' : 'reply');
    setComposeReplyTo({
      id: email.id,
      subject: email.subject,
      from: email.from.emailAddress,
      to: replyAll ? email.toRecipients : undefined,
      cc: replyAll ? email.ccRecipients : undefined,
    });
    setShowCompose(true);
  }, []);

  // Handle forward
  const handleForward = useCallback((email: Email) => {
    setComposeMode('forward');
    setComposeReplyTo({
      id: email.id,
      subject: email.subject,
      body: email.body.content,
      bodyType: email.body.contentType,
    });
    setShowCompose(true);
  }, []);

  // Handle new compose
  const handleNewCompose = useCallback(() => {
    setComposeMode('new');
    setComposeReplyTo(null);
    setShowCompose(true);
  }, []);

  // Search emails
  const searchEmails = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchEmails(selectedFolder);
      return;
    }

    try {
      setIsLoadingEmails(true);
      const response = await fetch(
        `/api/emails/search?q=${encodeURIComponent(searchQuery)}&folder=${selectedFolder}`
      );
      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setEmails(data.emails);
      setHasMore(false); // Disable infinite scroll for search results
    } catch (error) {
      console.error("Error searching emails:", error);
      toast.error("Search failed");
    } finally {
      setIsLoadingEmails(false);
    }
  }, [searchQuery, selectedFolder, fetchEmails]);

  // Initial load
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (!isLoadingFolders) {
      fetchEmails(selectedFolder);
    }
  }, [selectedFolder, isLoadingFolders, fetchEmails]);

  useEffect(() => {
    if (selectedEmailId) {
      fetchEmail(selectedEmailId);
    }
  }, [selectedEmailId, fetchEmail]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingEmails) {
          loadMoreEmails();
        }
      },
      { threshold: 0.1 }
    );

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoadingMore, isLoadingEmails, loadMoreEmails]);

  // Folder icon map
  const folderIcons: Record<string, React.ElementType> = {
    inbox: Inbox,
    send: Send,
    "file-text": FileText,
    archive: Archive,
    trash: Trash2,
    "alert-triangle": AlertTriangle,
    folder: Folder,
  };

  // If needs connection
  if (needsConnection) {
    return (
      <div className="h-screen">
        <Header title="Email" />
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Mail className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Connect Your Email</h2>
          <p className="text-muted-foreground">
            Connect your Microsoft 365 account to access your emails
          </p>
          <Button onClick={() => (window.location.href = "/api/email/connect")}>
            <Mail className="w-4 h-4 mr-2" />
            Connect Microsoft 365
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header title="Email" />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Folders */}
        <div className="w-64 border-r bg-muted/20 flex flex-col">
          <div className="p-4">
            <Button className="w-full" onClick={handleNewCompose}>
              <Plus className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoadingFolders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                folders.map((folder) => {
                  const Icon = folderIcons[folder.icon] || Folder;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => changeFolder(folder.name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors",
                        selectedFolder === folder.name && "bg-accent"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{folder.displayName}</span>
                      {folder.unreadCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {folder.unreadCount}
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => fetchFolders()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Email List */}
        <div className="w-96 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchEmails()}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => fetchEmails(selectedFolder)}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isLoadingEmails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No emails</p>
              </div>
            ) : (
              <div className="divide-y">
                {emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => selectEmail(email)}
                    className={cn(
                      "w-full p-4 text-left hover:bg-accent/50 transition-colors",
                      selectedEmail?.id === email.id && "bg-accent",
                      !email.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          {email.from.emailAddress.name[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("font-medium truncate", !email.isRead && "font-semibold")}>
                            {email.from.emailAddress.name || email.from.emailAddress.address}
                          </span>
                          {email.hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                          {email.flag.flagStatus === "flagged" && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                        </div>

                        <p className={cn("text-sm truncate mb-1", !email.isRead && "font-semibold")}>
                          {email.subject || "(No Subject)"}
                        </p>

                        <p className="text-xs text-muted-foreground truncate">{email.bodyPreview}</p>

                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Infinite scroll trigger */}
                {hasMore && !searchQuery && (
                  <div ref={loadMoreRef} className="p-4 text-center">
                    {isLoadingMore ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                    ) : (
                      <p className="text-xs text-muted-foreground">Scroll for more...</p>
                    )}
                  </div>
                )}

                {!hasMore && emails.length > 0 && !searchQuery && (
                  <div className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">No more emails</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Email Viewer */}
        <div className="flex-1 flex flex-col bg-background">
          {!selectedEmail ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Select an email to read</p>
                <p className="text-sm text-muted-foreground">Choose an email from the list</p>
              </div>
            </div>
          ) : isLoadingEmail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Email Header */}
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <h1 className="text-2xl font-semibold">{selectedEmail.subject || "(No Subject)"}</h1>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => deleteEmail(selectedEmail.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>
                      {selectedEmail.from.emailAddress.name[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{selectedEmail.from.emailAddress.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmail.from.emailAddress.address}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(selectedEmail.receivedDateTime), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>

                {selectedEmail.toRecipients.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    To: {selectedEmail.toRecipients.map((r) => r.emailAddress.address).join(", ")}
                  </p>
                )}

                {attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <a
                        key={att.id}
                        href={`/api/emails/${selectedEmail.id}/attachments?download=${att.id}`}
                        download={att.name}
                        className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent text-sm"
                      >
                        <Paperclip className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{att.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail, false)}>
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail, true)}>
                    <ReplyAll className="w-4 h-4 mr-2" />
                    Reply All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleForward(selectedEmail)}>
                    <Forward className="w-4 h-4 mr-2" />
                    Forward
                  </Button>
                </div>
              </div>

              {/* Email Body */}
              <ScrollArea className="flex-1 p-6">
                {selectedEmail.body.contentType === "html" ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert break-words overflow-wrap-anywhere"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body.content }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words">{selectedEmail.body.content}</div>
                )}

                {/* Thread */}
                {thread.length > 1 && (
                  <div className="mt-8 space-y-4">
                    <Separator />
                    <h3 className="font-semibold">Previous messages in this conversation</h3>
                    {thread
                      .filter((email) => email.id !== selectedEmail.id)
                      .map((email) => (
                        <div key={email.id} className="p-4 border rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>
                                {email.from.emailAddress.name[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{email.from.emailAddress.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(email.receivedDateTime), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{email.bodyPreview}</p>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={showCompose}
        onClose={() => setShowCompose(false)}
        mode={composeMode}
        replyTo={composeReplyTo}
        onSent={() => {
          setShowCompose(false);
          fetchEmails(selectedFolder);
        }}
      />
    </div>
  );
}
