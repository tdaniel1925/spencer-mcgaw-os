"use client";

import { Bell, Mail, MessageSquare, Search, Settings } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  breadcrumb?: string;
}

export function Header({ title, breadcrumb }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* Left: Page Title & Breadcrumb */}
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

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search here"
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-accent text-accent-foreground">
            9
          </Badge>
        </Button>

        {/* Messages */}
        <Button variant="ghost" size="icon" className="relative">
          <Mail className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive text-white">
            8
          </Badge>
        </Button>

        {/* Chat */}
        <Button variant="ghost" size="icon" className="relative">
          <MessageSquare className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
            4
          </Badge>
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">Hunter McGaw</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <Avatar className="h-9 w-9 border-2 border-accent">
                <AvatarImage src="/avatars/hunter.jpg" alt="Hunter McGaw" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  HM
                </AvatarFallback>
              </Avatar>
              <div className="w-2 h-2 rounded-full bg-green-500 absolute bottom-0 right-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Team Members</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
