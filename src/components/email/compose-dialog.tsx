"use client";

/**
 * Email Compose Dialog
 * Rich compose interface for sending emails
 */

import React, { useState } from "react";
import { toast } from "sonner";
import { X, Send, Paperclip, User, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: 'new' | 'reply' | 'replyAll' | 'forward';
  replyTo?: {
    id: string;
    subject: string;
    from?: { name: string; address: string };
    to?: Array<{ emailAddress: { name: string; address: string } }>;
    cc?: Array<{ emailAddress: { name: string; address: string } }>;
    body?: string;
    bodyType?: 'text' | 'html';
  };
  onSent?: () => void;
}

export function ComposeDialog({ open, onClose, mode = 'new', replyTo, onSent }: ComposeDialogProps) {
  // State with default empty values
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [importance, setImportance] = useState<"low" | "normal" | "high">("normal");
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // Update fields when dialog opens or mode/replyTo changes
  React.useEffect(() => {
    if (!open) {
      // Reset when closing
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setImportance("normal");
      setShowCc(false);
      setShowBcc(false);
      return;
    }

    // Initialize fields based on mode when opening
    if (!replyTo) {
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      setShowCc(false);
      return;
    }

    if (mode === 'reply') {
      setTo(replyTo.from?.address || '');
      setCc('');
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody('');
      setShowCc(false);
    } else if (mode === 'replyAll') {
      const toAddrs = replyTo.to?.map(r => r.emailAddress.address).join(', ') || '';
      const ccAddrs = replyTo.cc?.map(r => r.emailAddress.address).join(', ') || '';
      setTo([replyTo.from?.address, toAddrs].filter(Boolean).join(', '));
      setCc(ccAddrs);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody('');
      setShowCc(!!ccAddrs);
    } else if (mode === 'forward') {
      setTo('');
      setCc('');
      setSubject(replyTo.subject.startsWith('Fwd:') ? replyTo.subject : `Fwd: ${replyTo.subject}`);
      setBody(`\n\n--- Forwarded message ---\n${replyTo.body || ''}`);
      setShowCc(false);
    }
  }, [open, mode, replyTo]);

  const handleSend = async () => {
    // Validation
    if (!to.trim()) {
      toast.error("Please enter at least one recipient");
      return;
    }

    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    if (!body.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      setIsSending(true);

      // Parse recipients
      const parseRecipients = (input: string) => {
        return input
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean)
          .map((email) => ({
            name: email.split("@")[0],
            address: email,
          }));
      };

      const toRecipients = parseRecipients(to);
      const ccRecipients = cc ? parseRecipients(cc) : undefined;
      const bccRecipients = bcc ? parseRecipients(bcc) : undefined;

      const response = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toRecipients,
          cc: ccRecipients,
          bcc: bccRecipients,
          subject,
          body,
          bodyType: "html",
          importance,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Email sent successfully");
      onSent?.();
      onClose();

      // Reset form
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setImportance("normal");
      setShowCc(false);
      setShowBcc(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const dialogTitle = {
    new: 'New Message',
    reply: 'Reply',
    replyAll: 'Reply All',
    forward: 'Forward Message',
  }[mode];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-auto">
          {/* To */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to">To</Label>
              <div className="flex gap-2">
                {!showCc && (
                  <Button variant="ghost" size="sm" onClick={() => setShowCc(true)}>
                    Cc
                  </Button>
                )}
                {!showBcc && (
                  <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)}>
                    Bcc
                  </Button>
                )}
              </div>
            </div>
            <Input
              id="to"
              placeholder="recipient@example.com, another@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* Cc */}
          {showCc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cc">Cc</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowCc(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Input
                id="cc"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
          )}

          {/* Bcc */}
          {showBcc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bcc">Bcc</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowBcc(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Input
                id="bcc"
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Importance */}
          <div className="space-y-2">
            <Label htmlFor="importance">Importance</Label>
            <Select value={importance} onValueChange={(v: any) => setImportance(v)}>
              <SelectTrigger id="importance" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[300px] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" size="sm">
            <Paperclip className="w-4 h-4 mr-2" />
            Attach
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
