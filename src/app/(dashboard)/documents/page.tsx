"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  Upload,
  Bot,
  CheckCircle,
  Clock,
  Loader2,
  File,
  FileImage,
  FileSpreadsheet,
  Trash2,
  Mail,
  FolderOpen,
  AlertCircle,
  Eye,
  Download,
  Plus,
  Receipt,
  DollarSign,
  Calendar,
  Building2,
  Edit3,
  Send,
  Archive,
  Flag,
  X,
  ScanLine,
  ChevronDown,
  Check,
  User,
  Settings,
  Sparkles,
  ListPlus,
  Workflow,
  Copy,
  Printer,
  Bell,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Types
interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface ActionTemplate {
  id: string;
  label: string;
  icon: React.ElementType;
  category: "file" | "notify" | "task" | "integrate" | "custom";
  requiresInput?: boolean;
  inputPlaceholder?: string;
}

interface ExtractedItem {
  id: string;
  description: string;
  amount?: number;
  date?: Date;
  category?: string;
  selected: boolean;
}

interface SuggestedAction {
  id: string;
  templateId: string;
  label: string;
  icon: React.ElementType;
  selected: boolean;
  details?: string;
  isCustom?: boolean;
}

interface DocumentRule {
  id: string;
  name: string;
  documentType: string;
  actions: string[];
  isActive: boolean;
}

interface AnalyzedDocument {
  id: string;
  fileName: string;
  fileType: "pdf" | "image" | "spreadsheet";
  fileSize: string;
  clientId: string | null;
  suggestedClientId: string | null;
  uploadedAt: Date;
  status: "queued" | "analyzing" | "analyzed" | "processed";
  progress?: number;
  aiAnalysis?: {
    documentType: string;
    summary: string;
    totalAmount?: number;
    dateRange?: string;
    extractedItems: ExtractedItem[];
    suggestedActions: SuggestedAction[];
    confidence: number;
  };
}

interface ProcessedDocument {
  id: string;
  fileName: string;
  action: string;
  client: string;
  processedAt: Date;
}

// Empty clients array - real data comes from database
const docClients: Client[] = [];

// Available action templates
const actionTemplates: ActionTemplate[] = [
  // File actions
  { id: "file-client-folder", label: "File in client folder", icon: FolderOpen, category: "file" },
  { id: "file-tax-docs", label: "Add to tax return workpapers", icon: FileText, category: "file" },
  { id: "file-expenses", label: "Add to expense reports", icon: Receipt, category: "file" },
  { id: "file-archive", label: "Archive document", icon: Archive, category: "file" },

  // Notification actions
  { id: "email-client", label: "Email to client", icon: Mail, category: "notify" },
  { id: "email-summary", label: "Email summary to client", icon: Send, category: "notify" },
  { id: "notify-team", label: "Notify team member", icon: Bell, category: "notify", requiresInput: true, inputPlaceholder: "Select team member" },

  // Task actions
  { id: "create-task", label: "Create follow-up task", icon: CheckCircle, category: "task", requiresInput: true, inputPlaceholder: "Task description" },
  { id: "create-review-task", label: "Create review task", icon: Eye, category: "task" },
  { id: "flag-review", label: "Flag for manager review", icon: Flag, category: "task" },
  { id: "schedule-call", label: "Schedule client call", icon: Calendar, category: "task" },

  // Integration actions
  { id: "quickbooks-expense", label: "Add to QuickBooks (Expenses)", icon: DollarSign, category: "integrate" },
  { id: "quickbooks-income", label: "Add to QuickBooks (Income)", icon: DollarSign, category: "integrate" },
  { id: "quickbooks-reconcile", label: "Process bank reconciliation", icon: CheckCircle, category: "integrate" },

  // Custom
  { id: "custom", label: "Add custom action...", icon: Plus, category: "custom", requiresInput: true, inputPlaceholder: "Describe the action" },
];

// Document type specific rules
const defaultRules: DocumentRule[] = [
  {
    id: "rule-1",
    name: "W-2 Processing",
    documentType: "W-2",
    actions: ["file-tax-docs", "file-client-folder", "create-review-task"],
    isActive: true,
  },
  {
    id: "rule-2",
    name: "Receipt Processing",
    documentType: "Receipts",
    actions: ["quickbooks-expense", "file-expenses", "file-client-folder"],
    isActive: true,
  },
  {
    id: "rule-3",
    name: "Bank Statement Processing",
    documentType: "Bank Statement",
    actions: ["quickbooks-reconcile", "file-client-folder"],
    isActive: true,
  },
  {
    id: "rule-4",
    name: "1099 Processing",
    documentType: "1099",
    actions: ["file-tax-docs", "file-client-folder", "email-client"],
    isActive: true,
  },
];

// Empty arrays - real data comes from document uploads
const initialDocuments: AnalyzedDocument[] = [];
const initialProcessingQueue: AnalyzedDocument[] = [];
const initialRecentlyProcessed: ProcessedDocument[] = [];

const fileTypeIcons = {
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
};

// Client Selector Component
function ClientSelector({
  selectedClientId,
  suggestedClientId,
  onSelect,
}: {
  selectedClientId: string | null;
  suggestedClientId: string | null;
  onSelect: (clientId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedClient = docClients.find((c) => c.id === selectedClientId);
  const suggestedClient = docClients.find((c) => c.id === suggestedClientId);
  const isAISuggested = selectedClientId === suggestedClientId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between min-w-[200px]"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className={cn(!selectedClient && "text-muted-foreground")}>
              {selectedClient?.name || "Select client..."}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isAISuggested && selectedClient && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3 mr-0.5" />
                AI
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            {suggestedClient && (
              <CommandGroup heading="AI Suggested">
                <CommandItem
                  value={suggestedClient.name}
                  onSelect={() => {
                    onSelect(suggestedClient.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedClientId === suggestedClient.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{suggestedClient.name}</p>
                    <p className="text-xs text-muted-foreground">{suggestedClient.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3 mr-0.5" />
                    94% match
                  </Badge>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="All Clients">
              {docClients
                .filter((c) => c.id !== suggestedClientId)
                .map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      onSelect(client.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedClientId === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <p>{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem className="text-primary">
                <UserPlus className="mr-2 h-4 w-4" />
                Add new client...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Add Action Dropdown Component
function AddActionDropdown({
  onAddAction,
}: {
  onAddAction: (template: ActionTemplate, customLabel?: string) => void;
}) {
  const [customActionOpen, setCustomActionOpen] = useState(false);
  const [customActionLabel, setCustomActionLabel] = useState("");

  const groupedTemplates = {
    file: actionTemplates.filter((t) => t.category === "file"),
    notify: actionTemplates.filter((t) => t.category === "notify"),
    task: actionTemplates.filter((t) => t.category === "task"),
    integrate: actionTemplates.filter((t) => t.category === "integrate"),
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Action
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">File & Organize</DropdownMenuLabel>
          {groupedTemplates.file.map((template) => {
            const Icon = template.icon;
            return (
              <DropdownMenuItem key={template.id} onClick={() => onAddAction(template)}>
                <Icon className="h-4 w-4 mr-2" />
                {template.label}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Notifications</DropdownMenuLabel>
          {groupedTemplates.notify.map((template) => {
            const Icon = template.icon;
            return (
              <DropdownMenuItem key={template.id} onClick={() => onAddAction(template)}>
                <Icon className="h-4 w-4 mr-2" />
                {template.label}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Tasks</DropdownMenuLabel>
          {groupedTemplates.task.map((template) => {
            const Icon = template.icon;
            return (
              <DropdownMenuItem key={template.id} onClick={() => onAddAction(template)}>
                <Icon className="h-4 w-4 mr-2" />
                {template.label}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Integrations</DropdownMenuLabel>
          {groupedTemplates.integrate.map((template) => {
            const Icon = template.icon;
            return (
              <DropdownMenuItem key={template.id} onClick={() => onAddAction(template)}>
                <Icon className="h-4 w-4 mr-2" />
                {template.label}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomActionOpen(true)} className="text-primary">
            <Plus className="h-4 w-4 mr-2" />
            Custom action...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customActionOpen} onOpenChange={setCustomActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Action</DialogTitle>
            <DialogDescription>
              Create a custom action for this document. This can be saved as a rule for future documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-action">Action Description</Label>
              <Input
                id="custom-action"
                placeholder="e.g., Forward to external accountant"
                value={customActionLabel}
                onChange={(e) => setCustomActionLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomActionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (customActionLabel.trim()) {
                  onAddAction(
                    { id: "custom", label: customActionLabel, icon: Sparkles, category: "custom" },
                    customActionLabel
                  );
                  setCustomActionLabel("");
                  setCustomActionOpen(false);
                }
              }}
            >
              Add Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DocumentsPage() {
  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<AnalyzedDocument[]>(initialDocuments);
  const [processingQueue, setProcessingQueue] = useState<AnalyzedDocument[]>(initialProcessingQueue);
  const [recentlyProcessed] = useState<ProcessedDocument[]>(initialRecentlyProcessed);
  const [isDragging, setIsDragging] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [rules, setRules] = useState<DocumentRule[]>(defaultRules);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Simulate processing progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProcessingQueue((prev) =>
        prev.map((doc) => {
          if (doc.status === "analyzing" && doc.progress !== undefined) {
            const newProgress = Math.min(doc.progress + 5, 100);
            if (newProgress === 100) {
              setTimeout(() => {
                setProcessingQueue((q) => q.filter((d) => d.id !== doc.id));
                setDocuments((d) => [
                  {
                    ...doc,
                    id: `analyzed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    status: "analyzed",
                    clientId: doc.suggestedClientId,
                    aiAnalysis: {
                      documentType: "Bank Statement",
                      summary: "April 2024 bank statement showing account activity",
                      totalAmount: 45230.50,
                      dateRange: "April 1-30, 2024",
                      extractedItems: [
                        { id: "1", description: "Opening Balance", amount: 12500.00, category: "Balance", selected: true },
                        { id: "2", description: "Total Deposits", amount: 38750.50, category: "Deposits", selected: true },
                        { id: "3", description: "Total Withdrawals", amount: 6020.00, category: "Withdrawals", selected: true },
                      ],
                      suggestedActions: [
                        { id: "a1", templateId: "quickbooks-reconcile", label: "Process bank reconciliation", icon: CheckCircle, selected: true },
                        { id: "a2", templateId: "file-client-folder", label: "File in client folder", icon: FolderOpen, selected: true },
                      ],
                      confidence: 96,
                    },
                  },
                  ...d,
                ]);
              }, 500);
            }
            return { ...doc, progress: newProgress };
          }
          return doc;
        })
      );
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const newDoc: AnalyzedDocument = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: "Uploaded_Document.pdf",
      fileType: "pdf",
      fileSize: "1.2 MB",
      clientId: null,
      suggestedClientId: "c1",
      uploadedAt: new Date(),
      status: "analyzing",
      progress: 0,
    };
    setProcessingQueue((prev) => [...prev, newDoc]);
  }, []);

  const updateClientForDocument = (docId: string, clientId: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, clientId } : doc))
    );
  };

  const toggleItemSelection = (docId: string, itemId: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId && doc.aiAnalysis) {
          return {
            ...doc,
            aiAnalysis: {
              ...doc.aiAnalysis,
              extractedItems: doc.aiAnalysis.extractedItems.map((item) =>
                item.id === itemId ? { ...item, selected: !item.selected } : item
              ),
            },
          };
        }
        return doc;
      })
    );
  };

  const toggleActionSelection = (docId: string, actionId: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId && doc.aiAnalysis) {
          return {
            ...doc,
            aiAnalysis: {
              ...doc.aiAnalysis,
              suggestedActions: doc.aiAnalysis.suggestedActions.map((action) =>
                action.id === actionId ? { ...action, selected: !action.selected } : action
              ),
            },
          };
        }
        return doc;
      })
    );
  };

  const addActionToDocument = (docId: string, template: ActionTemplate, customLabel?: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId && doc.aiAnalysis) {
          const newAction: SuggestedAction = {
            id: `action-${Date.now()}`,
            templateId: template.id,
            label: customLabel || template.label,
            icon: template.icon,
            selected: true,
            isCustom: template.category === "custom",
          };
          return {
            ...doc,
            aiAnalysis: {
              ...doc.aiAnalysis,
              suggestedActions: [...doc.aiAnalysis.suggestedActions, newAction],
            },
          };
        }
        return doc;
      })
    );
  };

  const removeAction = (docId: string, actionId: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId && doc.aiAnalysis) {
          return {
            ...doc,
            aiAnalysis: {
              ...doc.aiAnalysis,
              suggestedActions: doc.aiAnalysis.suggestedActions.filter((a) => a.id !== actionId),
            },
          };
        }
        return doc;
      })
    );
  };

  const executeActions = (docId: string) => {
    setIsExecuting(docId);
    setTimeout(() => {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setIsExecuting(null);
    }, 1500);
  };

  const FileIcon = ({ type }: { type: "pdf" | "image" | "spreadsheet" }) => {
    const Icon = fileTypeIcons[type];
    return <Icon className="h-5 w-5" />;
  };

  return (
    <>
      <Header title="AI Document Processing" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-12 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-medium">Smart Document Inbox</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{documents.length} pending review</span>
            <span className="text-border">|</span>
            <span>{processingQueue.length} processing</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRulesDialogOpen(true)}>
            <Workflow className="h-4 w-4 mr-1" />
            Rules
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                isDragging ? "bg-primary/20" : "bg-muted"
              )}>
                <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="font-medium text-lg">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports PDF, Images (JPG, PNG), Excel, Word documents
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Browse Files
                </Button>
                <Button variant="outline" size="sm">
                  <ScanLine className="h-4 w-4 mr-2" />
                  Scan Document
                </Button>
              </div>
            </div>
          </div>

          {/* Processing Queue */}
          {processingQueue.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Processing Queue
              </h3>
              <div className="space-y-3">
                {processingQueue.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileIcon type={doc.fileType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Analyzing... {doc.progress}% complete
                      </p>
                      <Progress value={doc.progress} className="h-1.5 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Analyzed Documents */}
          {documents.map((doc) => {
            const client = docClients.find((c) => c.id === doc.clientId);
            return (
              <Card key={doc.id} className="overflow-hidden">
                {/* Document Header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileIcon type={doc.fileType} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{doc.fileName}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {doc.fileSize}
                        </Badge>
                      </div>
                      {/* Client Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Client:</span>
                        <ClientSelector
                          selectedClientId={doc.clientId}
                          suggestedClientId={doc.suggestedClientId}
                          onSelect={(clientId) => updateClientForDocument(doc.id, clientId)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                        Uploaded {formatDistanceToNow(doc.uploadedAt, { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* AI Analysis */}
                {doc.aiAnalysis && (
                  <div className="p-4 space-y-4">
                    {/* Analysis Summary */}
                    <div className="bg-primary/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">AI Analysis</span>
                        <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700 border-green-200">
                          {doc.aiAnalysis.confidence}% confidence
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Document Type</p>
                          <p className="font-medium text-sm">{doc.aiAnalysis.documentType}</p>
                        </div>
                        {doc.aiAnalysis.totalAmount && (
                          <div>
                            <p className="text-xs text-muted-foreground">Total Amount</p>
                            <p className="font-medium text-sm">${doc.aiAnalysis.totalAmount.toLocaleString()}</p>
                          </div>
                        )}
                        {doc.aiAnalysis.dateRange && (
                          <div>
                            <p className="text-xs text-muted-foreground">Date Range</p>
                            <p className="font-medium text-sm">{doc.aiAnalysis.dateRange}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Items Found</p>
                          <p className="font-medium text-sm">{doc.aiAnalysis.extractedItems.length} items</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">{doc.aiAnalysis.summary}</p>
                    </div>

                    {/* Extracted Items */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Extracted Items
                      </h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-48 overflow-auto">
                          {doc.aiAnalysis.extractedItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-3 p-3 text-sm",
                                idx !== doc.aiAnalysis!.extractedItems.length - 1 && "border-b"
                              )}
                            >
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={() => toggleItemSelection(doc.id, item.id)}
                              />
                              <span className="flex-1">{item.description}</span>
                              {item.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.category}
                                </Badge>
                              )}
                              {item.amount && (
                                <span className="font-medium">${item.amount.toLocaleString()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Suggested Actions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Actions
                        </h4>
                        <AddActionDropdown
                          onAddAction={(template, customLabel) =>
                            addActionToDocument(doc.id, template, customLabel)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        {doc.aiAnalysis.suggestedActions.map((action) => {
                          const ActionIcon = action.icon;
                          return (
                            <div
                              key={action.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-colors group",
                                action.selected
                                  ? "bg-primary/5 border-primary/30"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={action.selected}
                                onCheckedChange={() => toggleActionSelection(doc.id, action.id)}
                              />
                              <ActionIcon className={cn("h-4 w-4", action.selected && "text-primary")} />
                              <span className="flex-1 text-sm">{action.label}</span>
                              {action.isCustom && (
                                <Badge variant="outline" className="text-[10px]">Custom</Badge>
                              )}
                              {action.details && (
                                <span className="text-xs text-muted-foreground">{action.details}</span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAction(doc.id, action.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        className="flex-1 bg-primary"
                        onClick={() => executeActions(doc.id)}
                        disabled={isExecuting === doc.id}
                      >
                        {isExecuting === doc.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Execute Selected ({doc.aiAnalysis.suggestedActions.filter(a => a.selected).length})
                          </>
                        )}
                      </Button>
                      <Button variant="outline">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Recently Processed */}
          {recentlyProcessed.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Archive className="h-4 w-4" />
                Recently Processed
              </h3>
              <div className="space-y-2">
                {recentlyProcessed.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">{doc.fileName}</span>
                    <span className="text-sm text-muted-foreground">→ {doc.action}</span>
                    <span className="text-xs text-muted-foreground ml-auto" suppressHydrationWarning>
                      {formatDistanceToNow(doc.processedAt, { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty State */}
          {documents.length === 0 && processingQueue.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No documents to process</h3>
              <p className="text-muted-foreground text-sm">
                Upload or scan documents to get started with AI processing
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Rules Dialog */}
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Document Processing Rules
            </DialogTitle>
            <DialogDescription>
              Configure automatic actions based on document type. Rules are applied when AI detects specific document types.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[400px] overflow-auto">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "p-3 rounded-lg border",
                  rule.isActive ? "bg-primary/5 border-primary/20" : "bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={rule.isActive}
                      onCheckedChange={(checked) => {
                        setRules((prev) =>
                          prev.map((r) =>
                            r.id === rule.id ? { ...r, isActive: !!checked } : r
                          )
                        );
                      }}
                    />
                    <span className="font-medium text-sm">{rule.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{rule.documentType}</Badge>
                </div>
                <div className="ml-6 space-y-1">
                  {rule.actions.map((actionId) => {
                    const template = actionTemplates.find((t) => t.id === actionId);
                    if (!template) return null;
                    const Icon = template.icon;
                    return (
                      <div key={actionId} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3" />
                        <span>{template.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRulesDialogOpen(false)}>
              Close
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
