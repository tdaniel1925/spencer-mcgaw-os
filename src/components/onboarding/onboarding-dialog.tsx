"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageSquare,
  ListTodo,
  Kanban,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function OnboardingDialog({
  open,
  onOpenChange,
  userName,
  onComplete,
}: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const firstName = userName?.split(" ")[0] || "there";

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: `Welcome, ${firstName}!`,
      description: "Let's get you set up with Spencer McGaw Hub",
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            This quick guide will help you understand the key features of your new workspace.
            It only takes about 2 minutes.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <FeatureCard
              icon={<Mail className="h-5 w-5" />}
              title="Email Intelligence"
              description="AI-powered email management"
            />
            <FeatureCard
              icon={<ListTodo className="h-5 w-5" />}
              title="Task Management"
              description="Organize your work"
            />
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Team Chat"
              description="Collaborate in real-time"
            />
            <FeatureCard
              icon={<FolderOpen className="h-5 w-5" />}
              title="Client Files"
              description="Secure document storage"
            />
          </div>
        </div>
      ),
    },
    {
      id: "email",
      title: "Connect Your Email",
      description: "AI-powered email intelligence at your fingertips",
      icon: <Mail className="h-8 w-8 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Connect your Microsoft 365 email to unlock powerful AI features:
          </p>
          <ul className="space-y-3">
            <FeatureListItem
              title="Smart Classification"
              description="AI automatically categorizes and prioritizes emails"
            />
            <FeatureListItem
              title="Action Extraction"
              description="Important tasks and deadlines are automatically detected"
            />
            <FeatureListItem
              title="Client Matching"
              description="Emails are linked to the right clients automatically"
            />
          </ul>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mt-4">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              How to connect:
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Go to <strong>Settings → Email Accounts</strong> and click "Connect Microsoft Account"
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "tasks",
      title: "Task Management",
      description: "Two views to organize your work",
      icon: <ListTodo className="h-8 w-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-orange-500" />
                <h4 className="font-semibold">Organization Task Pool</h4>
                <Badge variant="outline" className="ml-auto">Shared</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Unassigned tasks that anyone on the team can claim. Perfect for distributing work
                and ensuring nothing falls through the cracks.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Access via: <strong>Tasks → Org Tasks</strong>
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Kanban className="h-5 w-5 text-purple-500" />
                <h4 className="font-semibold">My Task Board</h4>
                <Badge variant="outline" className="ml-auto">Personal</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Your personal Kanban board showing only tasks assigned to you. Drag and drop
                to update status as you work.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Access via: <strong>Tasks → My Board</strong>
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "chat",
      title: "Team Chat",
      description: "Real-time collaboration with your team",
      icon: <MessageSquare className="h-8 w-8 text-indigo-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Stay connected with your team through built-in messaging:
          </p>
          <ul className="space-y-3">
            <FeatureListItem
              title="Direct Messages"
              description="Private 1-on-1 conversations with team members"
            />
            <FeatureListItem
              title="Group Channels"
              description="Topic-based discussions for projects or departments"
            />
            <FeatureListItem
              title="@Mentions"
              description="Tag team members to get their attention"
            />
            <FeatureListItem
              title="File Sharing"
              description="Share documents directly in conversations"
            />
          </ul>
          <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4 mt-4">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              <Clock className="h-4 w-4 inline mr-1" />
              Messages sync in real-time — no need to refresh!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "files",
      title: "Client Files",
      description: "Secure document management for your clients",
      icon: <FolderOpen className="h-8 w-8 text-amber-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Keep all client documents organized and secure:
          </p>
          <ul className="space-y-3">
            <FeatureListItem
              title="Client Folders"
              description="Each client has their own secure folder for documents"
            />
            <FeatureListItem
              title="Version History"
              description="Track changes and restore previous versions"
            />
            <FeatureListItem
              title="Quick Search"
              description="Find any document instantly across all clients"
            />
            <FeatureListItem
              title="Secure Sharing"
              description="Share files with clients through secure links"
            />
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 mt-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Pro tip:
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Drag and drop files directly onto a client's page to upload them!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "complete",
      title: "You're All Set!",
      description: "Start exploring your new workspace",
      icon: <Check className="h-8 w-8 text-green-500" />,
      content: (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-muted-foreground">
            You're ready to go, {firstName}! Here are some next steps:
          </p>
          <div className="grid gap-2 text-left mt-6">
            <NextStepItem step="1" text="Connect your email account in Settings" />
            <NextStepItem step="2" text="Check out the Dashboard for an overview" />
            <NextStepItem step="3" text="Explore the Task Pool to see open work" />
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            You can revisit this guide anytime from <strong>Help → Getting Started</strong> in the menu.
          </p>
        </div>
      ),
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
      onOpenChange(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted">
              {steps[currentStep].icon}
            </div>
            <div>
              <DialogTitle className="text-xl">
                {steps[currentStep].title}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {steps[currentStep].description}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[280px]">
          {steps[currentStep].content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} of {steps.length}
            </span>
            {currentStep < steps.length - 1 && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip tour
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-primary">{icon}</div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureListItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Check className="h-3 w-3 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

function NextStepItem({ step, text }: { step: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
        {step}
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
