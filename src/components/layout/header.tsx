"use client";

import { Bell, Mail, MessageSquare, Search, UserPen, LogOut, Phone, X, PhoneIncoming, Clock, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth-context";
import { roleInfo } from "@/lib/permissions";
import { useCalls } from "@/lib/calls";
import { callCategoryInfo, urgencyInfo } from "@/lib/calls/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { PageBreadcrumb } from "./page-breadcrumb";
import { useNotifications } from "@/lib/notifications";

interface HeaderProps {
  title: string;
  /** Custom breadcrumb items to override auto-generated ones */
  breadcrumbItems?: Array<{ label: string; href?: string }>;
  /** Label for the current page (useful for dynamic pages) */
  currentPageLabel?: string;
}

export function Header({ title, breadcrumbItems, currentPageLabel }: HeaderProps) {
  const { user } = useAuth();
  const { notifications, unreadNotificationCount, markNotificationRead, dismissNotification, clearAllNotifications } = useCalls();
  const { counts } = useNotifications();

  const getUserInitials = () => {
    if (!user?.full_name) return user?.email?.charAt(0).toUpperCase() || "U";
    return user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const userRoleInfo = user?.role ? roleInfo[user.role] : null;

  // Get unread notifications
  const unreadNotifications = notifications.filter(n => !n.read && !n.dismissed);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-1.5 h-1.5 rounded-sm bg-muted-foreground" />
                <div className="w-1.5 h-1.5 rounded-sm bg-muted-foreground" />
                <div className="w-1.5 h-1.5 rounded-sm bg-muted-foreground" />
                <div className="w-1.5 h-1.5 rounded-sm bg-muted-foreground" />
              </div>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </div>
        <PageBreadcrumb customItems={breadcrumbItems} currentPageLabel={currentPageLabel} />
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search here"
            aria-label="Search across application"
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-2">
        {/* Call Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={unreadNotificationCount > 0 ? `${unreadNotificationCount} new call notifications` : "Call notifications"}
            >
              <Phone className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white animate-pulse" aria-hidden="true">
                  {unreadNotificationCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Call Notifications</span>
              </div>
              {unreadNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearAllNotifications}
                >
                  Clear all
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[300px]">
              {unreadNotifications.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No new call notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unreadNotifications.map((notification) => {
                    const categoryInfo = callCategoryInfo[notification.category];
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 hover:bg-muted/50 transition-colors relative",
                          notification.urgency === "urgent" && "bg-red-50"
                        )}
                      >
                        <div className="flex gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                              notification.urgency === "urgent"
                                ? "bg-red-100"
                                : "bg-primary/10"
                            )}
                          >
                            {notification.urgency === "urgent" ? (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <PhoneIncoming className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-sm truncate">
                                {notification.callerName || notification.callerPhone}
                              </span>
                              <Badge
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  urgencyInfo[notification.urgency]?.color
                                )}
                              >
                                {notification.urgency}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", categoryInfo?.color)}
                              >
                                {categoryInfo?.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(notification.createdAt, {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mt-1 -mr-1"
                            aria-label="Dismiss notification"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/calls">View all calls</Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* General Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={counts.general > 0 ? `${counts.general} notifications` : "No notifications"}
        >
          <Bell className="h-5 w-5" />
          {counts.general > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-accent text-accent-foreground" aria-hidden="true">
              {counts.general}
            </Badge>
          )}
        </Button>

        {/* Messages */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={counts.messages > 0 ? `${counts.messages} messages` : "No messages"}
        >
          <Mail className="h-5 w-5" />
          {counts.messages > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive text-white" aria-hidden="true">
              {counts.messages}
            </Badge>
          )}
        </Button>

        {/* Chat */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={counts.chat > 0 ? `${counts.chat} chat messages` : "No chat messages"}
        >
          <MessageSquare className="h-5 w-5" />
          {counts.chat > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground" aria-hidden="true">
              {counts.chat}
            </Badge>
          )}
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground">{userRoleInfo?.name || "Staff"}</p>
              </div>
              <Avatar className="h-9 w-9 border-2 border-accent">
                <AvatarImage src={user?.avatar_url || ""} alt={user?.full_name || "User"} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="w-2 h-2 rounded-full bg-green-500 absolute bottom-0 right-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.full_name || "User"}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserPen className="mr-2 h-4 w-4" />
                Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
