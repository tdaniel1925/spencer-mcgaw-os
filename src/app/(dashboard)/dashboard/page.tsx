"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { FeedPostCard } from "@/components/feed/feed-post";
import { AIChatDrawer } from "@/components/feed/ai-chat-drawer";
import type { FeedPost } from "@/app/api/feed/route";
import {
  LayoutDashboard,
  Loader2,
  Sparkles,
  Mail,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

type FilterType = 'all' | 'email' | 'call' | 'sms' | 'unhandled' | 'urgent';

export default function DashboardPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({
    calls: 0,
    emails: 0,
    total: 0,
    unread: 0,
    urgent: 0,
  });

  // AI Chat drawer state
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/feed?filter=${filter}&limit=50`);

      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }

      const data = await response.json();
      setPosts(data.posts || []);
      setStats(data.stats || {
        calls: 0,
        emails: 0,
        total: 0,
        unread: 0,
        urgent: 0,
      });
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      // Only show toast if it's been more than 5 minutes since last error
      const now = Date.now();
      if (now - lastErrorTime > 5 * 60 * 1000) {
        toast.error('Failed to load communications feed');
        setLastErrorTime(now);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, lastErrorTime]);

  useEffect(() => {
    fetchFeed();
    // Refresh every 60 seconds (reduced from 30)
    const interval = setInterval(fetchFeed, 60000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Handle chat open
  const handleChatOpen = (post: FeedPost) => {
    setSelectedPost(post);
    setChatDrawerOpen(true);
  };

  // Handle assign
  const handleAssign = async (post: FeedPost) => {
    toast.info('Assign dialog coming soon!');
    // TODO: Open assign dialog
  };

  // Handle mark done
  const handleMarkDone = async (post: FeedPost) => {
    try {
      // For now, just show a toast
      toast.success(`Marked "${post.subject}" as handled`);

      // Refresh feed
      await fetchFeed();
    } catch (error) {
      toast.error('Failed to mark as done');
    }
  };

  // Handle delete
  const handleDelete = async (post: FeedPost) => {
    if (!confirm('Are you sure you want to delete this?')) return;

    try {
      toast.success(`Deleted "${post.subject}"`);

      // Refresh feed
      await fetchFeed();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    const firstName = user?.full_name?.split(" ")[0] || "";

    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  if (!mounted) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Communications Feed" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">Feed</span>
          </div>

          <div className="flex-1" />

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-purple-600" />
              <span className="text-muted-foreground">{stats.emails} emails</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-muted-foreground">{stats.calls} calls</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className={cn(
                "h-4 w-4",
                stats.unread > 0 ? "text-amber-600" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium",
                stats.unread > 0 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {stats.unread} unread
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className={cn(
                "h-4 w-4",
                stats.urgent > 0 ? "text-red-600" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium",
                stats.urgent > 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {stats.urgent} urgent
              </span>
            </div>
          </div>

          <div className="h-4 border-l mx-2" />

          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {format(currentTime, "EEEE, MMMM d")}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filter:</span>

          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('all')}
          >
            All
          </Button>

          <Button
            variant={filter === 'unhandled' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('unhandled')}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Unhandled
          </Button>

          <Button
            variant={filter === 'urgent' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('urgent')}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Urgent
          </Button>

          <div className="h-4 border-l mx-2" />

          <Button
            variant={filter === 'email' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('email')}
          >
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>

          <Button
            variant={filter === 'call' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('call')}
          >
            <Phone className="h-3 w-3 mr-1" />
            Calls
          </Button>

          <Button
            variant={filter === 'sms' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('sms')}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            SMS
          </Button>
        </div>

        {/* Feed Content */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-4 space-y-3">
              {/* Greeting */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">{getGreeting()}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {posts.length === 0
                        ? "You're all caught up! No new communications."
                        : `You have ${posts.length} communication${posts.length > 1 ? 's' : ''} in your feed. Chat with AI to take action.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Empty State */}
              {!loading && posts.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">All Clear!</h3>
                  <p className="text-sm text-muted-foreground">
                    No communications match your current filter.
                  </p>
                </div>
              )}

              {/* Feed Posts */}
              {!loading && posts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  onChatOpen={handleChatOpen}
                  onAssign={handleAssign}
                  onMarkDone={handleMarkDone}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* AI Chat Drawer */}
      <AIChatDrawer
        open={chatDrawerOpen}
        onOpenChange={setChatDrawerOpen}
        post={selectedPost}
        onActionComplete={() => {
          // Refresh feed when actions are performed
          fetchFeed();
        }}
      />
    </>
  );
}
