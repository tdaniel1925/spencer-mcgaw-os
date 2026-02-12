"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  UserPlus,
  CheckCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  Paperclip,
  Star,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { FeedPost } from "@/app/api/feed/route";

interface FeedPostCardProps {
  post: FeedPost;
  onChatOpen: (post: FeedPost) => void;
  onAssign: (post: FeedPost) => void;
  onMarkDone: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
}

export function FeedPostCard({
  post,
  onChatOpen,
  onAssign,
  onMarkDone,
  onDelete,
}: FeedPostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get icon based on type
  const getTypeIcon = () => {
    switch (post.type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Get type color
  const getTypeColor = () => {
    switch (post.type) {
      case 'email':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'call':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'sms':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'chat':
        return 'bg-amber-50 text-amber-700 border-amber-300';
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get sentiment color
  const getSentimentColor = (sentiment?: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'negative':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      !post.isRead && "border-l-4 border-l-primary",
      post.priority === 'urgent' && "border-red-200 bg-red-50/30"
    )}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-muted">
                {getInitials(post.from)}
              </AvatarFallback>
            </Avatar>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Type & Metadata */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className={cn("text-xs font-medium", getTypeColor())}>
                  {getTypeIcon()}
                  <span className="ml-1 capitalize">{post.type}</span>
                </Badge>

                {/* Call direction */}
                {post.type === 'call' && post.direction && (
                  <Badge variant="secondary" className="text-[10px]">
                    {post.direction === 'inbound' ? (
                      <PhoneIncoming className="h-3 w-3 mr-1" />
                    ) : (
                      <PhoneOutgoing className="h-3 w-3 mr-1" />
                    )}
                    {post.direction}
                  </Badge>
                )}

                {/* Unassigned indicator */}
                {post.type === 'email' && post.userId === null && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                    Unassigned
                  </Badge>
                )}

                {/* Flagged */}
                {post.isFlagged && (
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                )}

                {/* Attachments */}
                {post.hasAttachments && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>{post.attachmentCount}</span>
                  </div>
                )}

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground ml-auto">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                </span>
              </div>

              {/* From */}
              <p className="font-semibold text-sm truncate">{post.from}</p>

              {/* Subject */}
              <p className="text-sm font-medium text-foreground truncate mt-1">
                {post.subject}
              </p>

              {/* Preview (if not expanded) */}
              {!isExpanded && post.preview && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {post.preview}
                </p>
              )}

              {/* AI Summary */}
              {post.aiSummary && !isExpanded && (
                <div className="bg-primary/5 border border-primary/10 rounded-md p-2 mt-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary mb-0.5">AI Summary</p>
                      <p className="text-xs text-foreground">{post.aiSummary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sentiment & Intent */}
              {(post.sentiment || post.intent) && !isExpanded && (
                <div className="flex gap-2 mt-2">
                  {post.sentiment && (
                    <Badge variant="outline" className={cn("text-[10px]", getSentimentColor(post.sentiment))}>
                      {post.sentiment}
                    </Badge>
                  )}
                  {post.intent && (
                    <Badge variant="outline" className="text-[10px]">
                      {post.intent}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="space-y-3 pl-13 pt-2 border-t">
              {/* AI Summary (expanded) */}
              {post.aiSummary && (
                <div className="bg-primary/5 border border-primary/10 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary mb-1">AI Summary</p>
                      <p className="text-sm text-muted-foreground">{post.aiSummary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Content */}
              {post.type === 'call' && post.transcription && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-sm font-medium mb-2">Transcription</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {post.transcription}
                  </p>
                </div>
              )}

              {post.type === 'call' && post.recordingUrl && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-sm font-medium mb-2">Recording</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Play Recording
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {post.duration ? `${Math.floor(post.duration / 60)}:${String(post.duration % 60).padStart(2, '0')}` : ''}
                    </span>
                  </div>
                </div>
              )}

              {post.type === 'email' && (post.bodyHtml || post.bodyText) && (
                <div className="bg-muted/50 rounded-md p-3 max-h-96 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Message</p>
                  {post.bodyHtml ? (
                    <div
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {post.bodyText}
                    </p>
                  )}
                </div>
              )}

              {/* Sentiment & Intent */}
              {(post.sentiment || post.intent) && (
                <div className="flex gap-2">
                  {post.sentiment && (
                    <Badge variant="outline" className={cn("text-xs", getSentimentColor(post.sentiment))}>
                      Sentiment: {post.sentiment}
                    </Badge>
                  )}
                  {post.intent && (
                    <Badge variant="outline" className="text-xs">
                      Intent: {post.intent}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {/* Primary Action: Chat with AI */}
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => onChatOpen(post)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat with AI
            </Button>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => onAssign(post)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Assign
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => onMarkDone(post)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Done
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive hover:text-destructive"
                onClick={() => onDelete(post)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {/* Expand/Collapse */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
