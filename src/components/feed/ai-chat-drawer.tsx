"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle,
  Mail,
  Phone,
  MessageSquare,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/app/api/feed/route";
import { toast } from "sonner";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: {
    type: 'task_created' | 'assigned' | 'email_sent' | 'meeting_scheduled';
    description: string;
  }[];
}

interface AIChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: FeedPost | null;
  onActionComplete?: () => void;
}

export function AIChatDrawer({ open, onOpenChange, post, onActionComplete }: AIChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize with AI greeting when post changes
  useEffect(() => {
    if (post && open) {
      const greeting: Message = {
        id: 'greeting',
        role: 'assistant',
        content: `Hi! I'm here to help you with this ${post.type}${post.aiSummary ? `. Here's what I know:\n\n${post.aiSummary}` : '.'}\n\nWhat would you like me to do? I can:\n• Create a task\n• Assign this to someone\n• Send a reply\n• Schedule a meeting\n• Just answer questions`,
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [post, open]);

  const handleSend = async () => {
    if (!input.trim() || !post) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call AI API with context
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: {
            post,
            conversationHistory: messages,
          },
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions,
      };

      setMessages(prev => [...prev, aiMessage]);

      // If actions were performed, notify parent
      if (data.actions && data.actions.length > 0) {
        onActionComplete?.();

        // Show toast for each action
        data.actions.forEach((action: any) => {
          toast.success(action.description);
        });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!post) return null;

  // Get icon based on post type
  const getTypeIcon = () => {
    switch (post.type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'sms':
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {getTypeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg line-clamp-1">{post.subject}</SheetTitle>
              <SheetDescription className="line-clamp-1">
                {post.type === 'email' ? 'Email' : post.type === 'call' ? 'Phone Call' : 'Message'} from {post.from}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' && "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={cn(
                    message.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {message.role === 'assistant' ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Message */}
                <div className={cn(
                  "flex-1 space-y-2",
                  message.role === 'user' && "flex flex-col items-end"
                )}>
                  <div className={cn(
                    "rounded-lg px-4 py-2 max-w-[85%]",
                    message.role === 'assistant'
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground ml-auto"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Actions performed */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="space-y-1.5">
                      {message.actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs bg-green-50 border border-green-200 rounded-md px-3 py-2 max-w-[85%]"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-green-900">{action.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground px-2">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything or tell me what to do..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
