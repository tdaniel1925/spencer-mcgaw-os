"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useAudit } from "@/lib/audit";
import { useAuth } from "@/lib/supabase/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  Edit,
  FileText,
  MessageSquare,
  Clock,
  CheckCircle,
  Eye,
  Plus,
  Trash2,
  User,
  Users,
  Briefcase,
  Receipt,
  AlertCircle,
  ChevronRight,
  MoreVertical,
  Pin,
  PinOff,
  ExternalLink,
  ArrowLeft,
  Globe,
  DollarSign,
  TrendingUp,
  CalendarDays,
  PhoneCall,
  MailOpen,
  Video,
  StickyNote,
  Filter,
  Search,
  RefreshCw,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { toast } from "sonner";

// Types
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  status: string;
  client_type: string;
  business_structure: string;
  industry: string;
  ein_tin: string;
  fiscal_year_end: string;
  acquisition_source: string;
  referred_by_client_id: string;
  assigned_accountant_id: string;
  billing_rate: number;
  retainer_amount: number;
  tags: string[];
  client_since: string;
  website: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface ClientContact {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  is_authorized_signer: boolean;
  receives_tax_docs: boolean;
  receives_invoices: boolean;
  birthday: string;
  notes: string;
  created_at: string;
}

interface ClientNote {
  id: string;
  client_id: string;
  contact_id: string | null;
  user_id: string;
  note_type: string;
  subject: string;
  content: string;
  is_pinned: boolean;
  is_private: boolean;
  follow_up_date: string | null;
  follow_up_assigned_to: string | null;
  follow_up_completed: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    avatar_url: string;
  };
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface ClientService {
  id: string;
  client_id: string;
  service_type: string;
  service_name: string;
  description: string;
  frequency: string;
  status: string;
  start_date: string;
  end_date: string;
  fee_type: string;
  fee_amount: number;
  assigned_to: string;
  tax_year: number;
  notes: string;
  created_at: string;
}

interface ClientTaxFiling {
  id: string;
  client_id: string;
  tax_year: number;
  filing_type: string;
  status: string;
  due_date: string;
  extended_due_date: string;
  filed_date: string;
  accepted_date: string;
  refund_amount: number;
  amount_owed: number;
  preparer_id: string;
  reviewer_id: string;
  notes: string;
  efile_status: string;
  document_progress?: {
    received: number;
    total: number;
  };
  created_at: string;
}

interface ClientDeadline {
  id: string;
  client_id: string;
  deadline_type: string;
  title: string;
  description: string;
  due_date: string;
  reminder_days: number[];
  status: string;
  assigned_to: string;
  tax_year: number;
  created_at: string;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string;
  user?: {
    full_name: string;
    avatar_url: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SMSConversation {
  id: string;
  contact_id: string;
  phone_number: string;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface SMSMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
}

// Note types configuration
const noteTypes = [
  { value: "general", label: "General", icon: StickyNote, color: "bg-slate-100 text-slate-700" },
  { value: "call", label: "Call", icon: PhoneCall, color: "bg-green-100 text-green-700" },
  { value: "meeting", label: "Meeting", icon: Video, color: "bg-blue-100 text-blue-700" },
  { value: "email", label: "Email", icon: MailOpen, color: "bg-purple-100 text-purple-700" },
  { value: "document", label: "Document", icon: FileText, color: "bg-amber-100 text-amber-700" },
  { value: "billing", label: "Billing", icon: Receipt, color: "bg-emerald-100 text-emerald-700" },
  { value: "tax", label: "Tax", icon: DollarSign, color: "bg-red-100 text-red-700" },
  { value: "compliance", label: "Compliance", icon: AlertCircle, color: "bg-orange-100 text-orange-700" },
];

// Service types
const serviceTypes = [
  { value: "tax_prep_individual", label: "Individual Tax Preparation" },
  { value: "tax_prep_business", label: "Business Tax Preparation" },
  { value: "bookkeeping", label: "Bookkeeping" },
  { value: "payroll", label: "Payroll Services" },
  { value: "audit", label: "Audit & Assurance" },
  { value: "consulting", label: "Tax Consulting" },
  { value: "estate_planning", label: "Estate Planning" },
  { value: "irs_representation", label: "IRS Representation" },
  { value: "other", label: "Other" },
];

// Filing types
const filingTypes = [
  { value: "1040", label: "Form 1040 (Individual)" },
  { value: "1120", label: "Form 1120 (C-Corp)" },
  { value: "1120S", label: "Form 1120S (S-Corp)" },
  { value: "1065", label: "Form 1065 (Partnership)" },
  { value: "990", label: "Form 990 (Nonprofit)" },
  { value: "941", label: "Form 941 (Payroll)" },
  { value: "state", label: "State Return" },
  { value: "local", label: "Local Return" },
];

// Filing status pipeline
const filingStatuses = [
  { value: "not_started", label: "Not Started", color: "bg-slate-100 text-slate-700" },
  { value: "documents_requested", label: "Docs Requested", color: "bg-yellow-100 text-yellow-700" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "review", label: "Review", color: "bg-purple-100 text-purple-700" },
  { value: "client_review", label: "Client Review", color: "bg-cyan-100 text-cyan-700" },
  { value: "ready_to_file", label: "Ready to File", color: "bg-indigo-100 text-indigo-700" },
  { value: "filed", label: "Filed", color: "bg-green-100 text-green-700" },
  { value: "accepted", label: "Accepted", color: "bg-emerald-100 text-emerald-700" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { user } = useAuth();
  const { log } = useAudit();

  // State
  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [services, setServices] = useState<ClientService[]>([]);
  const [taxFilings, setTaxFilings] = useState<ClientTaxFiling[]>([]);
  const [deadlines, setDeadlines] = useState<ClientDeadline[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [smsConversations, setSmsConversations] = useState<SMSConversation[]>([]);
  const [smsMessages, setSmsMessages] = useState<Record<string, SMSMessage[]>>({});
  const [loadingSms, setLoadingSms] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Modal states
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddFiling, setShowAddFiling] = useState(false);
  const [showAddDeadline, setShowAddDeadline] = useState(false);

  // Note form state
  const [noteForm, setNoteForm] = useState({
    note_type: "general",
    subject: "",
    content: "",
    is_pinned: false,
    is_private: false,
    follow_up_date: "",
    follow_up_assigned_to: "",
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    is_primary: false,
    is_authorized_signer: false,
    receives_tax_docs: true,
    receives_invoices: false,
    notes: "",
  });

  // Service form state
  const [serviceForm, setServiceForm] = useState({
    service_type: "tax_preparation",
    service_name: "",
    description: "",
    frequency: "annual",
    status: "active",
    start_date: "",
    fee_type: "fixed",
    fee_amount: "",
    tax_year: new Date().getFullYear().toString(),
  });

  // Filing form state
  const [filingForm, setFilingForm] = useState({
    tax_year: new Date().getFullYear().toString(),
    filing_type: "1040",
    status: "not_started",
    due_date: "",
    notes: "",
  });

  // Deadline form state
  const [deadlineForm, setDeadlineForm] = useState({
    deadline_type: "tax_filing",
    title: "",
    description: "",
    due_date: "",
    tax_year: new Date().getFullYear().toString(),
  });

  // Form submission loading states
  const [submittingContact, setSubmittingContact] = useState(false);
  const [submittingService, setSubmittingService] = useState(false);
  const [submittingFiling, setSubmittingFiling] = useState(false);
  const [submittingDeadline, setSubmittingDeadline] = useState(false);

  // Filter states
  const [noteTypeFilter, setNoteTypeFilter] = useState("all");

  // Load client data
  const loadClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
      }
    } catch (error) {
      console.error("Error loading client:", error);
      toast.error("Failed to load client");
    }
  }, [clientId]);

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  }, [clientId]);

  // Load notes
  const loadNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (noteTypeFilter !== "all") params.set("type", noteTypeFilter);

      const res = await fetch(`/api/crm/clients/${clientId}/notes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, [clientId, noteTypeFilter]);

  // Load services
  const loadServices = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/services`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error("Error loading services:", error);
    }
  }, [clientId]);

  // Load tax filings
  const loadTaxFilings = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/tax-filings`);
      if (res.ok) {
        const data = await res.json();
        setTaxFilings(data.filings || []);
      }
    } catch (error) {
      console.error("Error loading tax filings:", error);
    }
  }, [clientId]);

  // Load deadlines
  const loadDeadlines = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/deadlines?upcoming=true`);
      if (res.ok) {
        const data = await res.json();
        setDeadlines(data.deadlines || []);
      }
    } catch (error) {
      console.error("Error loading deadlines:", error);
    }
  }, [clientId]);

  // Load activity
  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/activity?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error loading activity:", error);
    }
  }, [clientId]);

  // Load SMS conversations for this client
  const loadSmsConversations = useCallback(async () => {
    setLoadingSms(true);
    try {
      const res = await fetch(`/api/sms/conversations?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setSmsConversations(data.conversations || []);

        // Load messages for each conversation
        const messagesMap: Record<string, SMSMessage[]> = {};
        for (const conv of data.conversations || []) {
          const msgRes = await fetch(`/api/sms/conversations/${conv.id}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            messagesMap[conv.id] = msgData.messages || [];
          }
        }
        setSmsMessages(messagesMap);
      }
    } catch (error) {
      console.error("Error loading SMS conversations:", error);
    } finally {
      setLoadingSms(false);
    }
  }, [clientId]);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        loadClient(),
        loadContacts(),
        loadNotes(),
        loadServices(),
        loadTaxFilings(),
        loadDeadlines(),
        loadActivity(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [loadClient, loadContacts, loadNotes, loadServices, loadTaxFilings, loadDeadlines, loadActivity]);

  // Reload notes when filter changes
  useEffect(() => {
    if (!loading) {
      loadNotes();
    }
  }, [noteTypeFilter, loadNotes, loading]);

  // Log client view
  useEffect(() => {
    if (client) {
      log({
        category: "client",
        action: "client_view",
        resource: {
          type: "client",
          id: client.id,
          name: client.name,
        },
      });
    }
  }, [client, log]);

  // Add note handler
  const handleAddNote = async () => {
    if (!noteForm.content.trim()) return;

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteForm),
      });

      if (res.ok) {
        toast.success("Note added");
        setShowAddNote(false);
        setNoteForm({
          note_type: "general",
          subject: "",
          content: "",
          is_pinned: false,
          is_private: false,
          follow_up_date: "",
          follow_up_assigned_to: "",
        });
        loadNotes();
        loadActivity();
      } else {
        toast.error("Failed to add note");
      }
    } catch (error) {
      toast.error("Failed to add note");
    }
  };

  // Toggle note pin
  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !isPinned }),
      });

      if (res.ok) {
        toast.success(isPinned ? "Note unpinned" : "Note pinned");
        loadNotes();
      }
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/notes/${noteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Note deleted");
        loadNotes();
      }
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  // Add contact handler
  const handleAddContact = async () => {
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }

    setSubmittingContact(true);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });

      if (res.ok) {
        toast.success("Contact added");
        setShowAddContact(false);
        setContactForm({
          first_name: "",
          last_name: "",
          title: "",
          email: "",
          phone: "",
          mobile: "",
          is_primary: false,
          is_authorized_signer: false,
          receives_tax_docs: true,
          receives_invoices: false,
          notes: "",
        });
        loadContacts();
      } else {
        toast.error("Failed to add contact");
      }
    } catch (error) {
      toast.error("Failed to add contact");
    } finally {
      setSubmittingContact(false);
    }
  };

  // Add service handler
  const handleAddService = async () => {
    if (!serviceForm.service_name.trim()) {
      toast.error("Service name is required");
      return;
    }

    setSubmittingService(true);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...serviceForm,
          fee_amount: serviceForm.fee_amount ? parseFloat(serviceForm.fee_amount) : null,
          tax_year: serviceForm.tax_year ? parseInt(serviceForm.tax_year) : null,
        }),
      });

      if (res.ok) {
        toast.success("Service added");
        setShowAddService(false);
        setServiceForm({
          service_type: "tax_preparation",
          service_name: "",
          description: "",
          frequency: "annual",
          status: "active",
          start_date: "",
          fee_type: "fixed",
          fee_amount: "",
          tax_year: new Date().getFullYear().toString(),
        });
        loadServices();
        loadActivity();
      } else {
        toast.error("Failed to add service");
      }
    } catch (error) {
      toast.error("Failed to add service");
    } finally {
      setSubmittingService(false);
    }
  };

  // Add filing handler
  const handleAddFiling = async () => {
    if (!filingForm.filing_type) {
      toast.error("Filing type is required");
      return;
    }

    setSubmittingFiling(true);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/tax-filings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filingForm,
          tax_year: parseInt(filingForm.tax_year),
        }),
      });

      if (res.ok) {
        toast.success("Tax filing added");
        setShowAddFiling(false);
        setFilingForm({
          tax_year: new Date().getFullYear().toString(),
          filing_type: "1040",
          status: "not_started",
          due_date: "",
          notes: "",
        });
        loadTaxFilings();
        loadDeadlines();
        loadActivity();
      } else {
        toast.error("Failed to add tax filing");
      }
    } catch (error) {
      toast.error("Failed to add tax filing");
    } finally {
      setSubmittingFiling(false);
    }
  };

  // Add deadline handler
  const handleAddDeadline = async () => {
    if (!deadlineForm.title.trim() || !deadlineForm.due_date) {
      toast.error("Title and due date are required");
      return;
    }

    setSubmittingDeadline(true);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/deadlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deadlineForm,
          tax_year: deadlineForm.tax_year ? parseInt(deadlineForm.tax_year) : null,
        }),
      });

      if (res.ok) {
        toast.success("Deadline added");
        setShowAddDeadline(false);
        setDeadlineForm({
          deadline_type: "tax_filing",
          title: "",
          description: "",
          due_date: "",
          tax_year: new Date().getFullYear().toString(),
        });
        loadDeadlines();
      } else {
        toast.error("Failed to add deadline");
      }
    } catch (error) {
      toast.error("Failed to add deadline");
    } finally {
      setSubmittingDeadline(false);
    }
  };

  // Delete contact handler
  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Contact deleted");
        loadContacts();
      } else {
        toast.error("Failed to delete contact");
      }
    } catch (error) {
      toast.error("Failed to delete contact");
    }
  };

  // Set primary contact handler
  const handleSetPrimaryContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });

      if (res.ok) {
        toast.success("Primary contact updated");
        loadContacts();
      } else {
        toast.error("Failed to update contact");
      }
    } catch (error) {
      toast.error("Failed to update contact");
    }
  };

  // Start SMS conversation with contact
  const handleSendSMS = async (contact: ClientContact) => {
    const phoneNumber = contact.mobile || contact.phone;
    if (!phoneNumber) {
      toast.error("Contact has no phone number");
      return;
    }

    try {
      // Create or get existing conversation
      const res = await fetch("/api/sms/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id }),
      });

      if (res.ok) {
        const conversation = await res.json();
        // Navigate to SMS page with this conversation selected
        router.push(`/sms?conversation=${conversation.id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to start conversation");
      }
    } catch (error) {
      toast.error("Failed to start conversation");
    }
  };

  // Delete service handler
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/services/${serviceId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Service deleted");
        loadServices();
        loadActivity();
      } else {
        toast.error("Failed to delete service");
      }
    } catch (error) {
      toast.error("Failed to delete service");
    }
  };

  // Update service status handler
  const handleUpdateServiceStatus = async (serviceId: string, status: string) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/services/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success("Service status updated");
        loadServices();
      } else {
        toast.error("Failed to update service");
      }
    } catch (error) {
      toast.error("Failed to update service");
    }
  };

  // Delete tax filing handler
  const handleDeleteFiling = async (filingId: string) => {
    if (!confirm("Are you sure you want to delete this tax filing?")) return;

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/tax-filings/${filingId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Tax filing deleted");
        loadTaxFilings();
        loadActivity();
      } else {
        toast.error("Failed to delete filing");
      }
    } catch (error) {
      toast.error("Failed to delete filing");
    }
  };

  // Update tax filing status handler
  const handleUpdateFilingStatus = async (filingId: string, status: string) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/tax-filings/${filingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success("Filing status updated");
        loadTaxFilings();
      } else {
        toast.error("Failed to update filing");
      }
    } catch (error) {
      toast.error("Failed to update filing");
    }
  };

  // Delete deadline handler
  const handleDeleteDeadline = async (deadlineId: string) => {
    if (!confirm("Are you sure you want to delete this deadline?")) return;

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/deadlines/${deadlineId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Deadline deleted");
        loadDeadlines();
      } else {
        toast.error("Failed to delete deadline");
      }
    } catch (error) {
      toast.error("Failed to delete deadline");
    }
  };

  // Toggle deadline completion handler
  const handleToggleDeadline = async (deadlineId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "upcoming" : "completed";

    try {
      const res = await fetch(`/api/crm/clients/${clientId}/deadlines/${deadlineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(newStatus === "completed" ? "Deadline completed" : "Deadline reopened");
        loadDeadlines();
      } else {
        toast.error("Failed to update deadline");
      }
    } catch (error) {
      toast.error("Failed to update deadline");
    }
  };

  // Group notes by date for timeline
  const groupNotesByDate = (notes: ClientNote[]) => {
    const groups: { label: string; notes: ClientNote[] }[] = [];
    let currentLabel = "";

    const pinnedNotes = notes.filter(n => n.is_pinned);
    const unpinnedNotes = notes.filter(n => !n.is_pinned);

    if (pinnedNotes.length > 0) {
      groups.push({ label: "PINNED", notes: pinnedNotes });
    }

    unpinnedNotes.forEach(note => {
      const noteDate = parseISO(note.created_at);
      let label = "";

      if (isToday(noteDate)) {
        label = "TODAY";
      } else if (isYesterday(noteDate)) {
        label = "YESTERDAY";
      } else {
        label = format(noteDate, "MMMM d, yyyy").toUpperCase();
      }

      if (label !== currentLabel) {
        groups.push({ label, notes: [note] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].notes.push(note);
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <>
        <Header title="Client Detail" />
        <main className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </main>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Header title="Client Not Found" />
        <main className="p-6">
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Client Not Found</h2>
            <p className="text-muted-foreground mb-4">The client you&apos;re looking for doesn&apos;t exist.</p>
            <Button asChild>
              <Link href="/clients">Back to Clients</Link>
            </Button>
          </Card>
        </main>
      </>
    );
  }

  const primaryContact = contacts.find(c => c.is_primary);
  const noteGroups = groupNotesByDate(notes);
  const activeServices = services.filter(s => s.status === "active");
  const upcomingDeadlines = deadlines.slice(0, 5);

  return (
    <>
      <Header title={client.name} />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <Link href="/clients" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Clients</span>
          </Link>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {client.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold">{client.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn(
                  "text-[10px] px-1.5 py-0",
                  client.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                )}>
                  {client.status || "Active"}
                </Badge>
                {client.client_type && (
                  <span className="capitalize">{client.client_type.replace("_", " ")}</span>
                )}
                {client.client_since && (
                  <span>Client since {format(parseISO(client.client_since), "MMM yyyy")}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <Phone className="h-4 w-4 mr-1.5" />
              Call
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Mail className="h-4 w-4 mr-1.5" />
              Email
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Edit className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>

        {/* Content with Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card/50 px-4">
              <TabsList className="h-12 bg-transparent gap-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-background">Overview</TabsTrigger>
                <TabsTrigger value="notes" className="data-[state=active]:bg-background">
                  Notes
                  {notes.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{notes.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="contacts" className="data-[state=active]:bg-background">
                  Contacts
                  {contacts.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{contacts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="services" className="data-[state=active]:bg-background">Services</TabsTrigger>
                <TabsTrigger value="tax-history" className="data-[state=active]:bg-background">Tax History</TabsTrigger>
                <TabsTrigger value="deadlines" className="data-[state=active]:bg-background">
                  Deadlines
                  {upcomingDeadlines.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{upcomingDeadlines.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-background">Activity</TabsTrigger>
                <TabsTrigger value="sms" className="data-[state=active]:bg-background" onClick={() => !smsConversations.length && loadSmsConversations()}>
                  SMS
                  {smsConversations.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
                    <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5">
                      {smsConversations.reduce((acc, c) => acc + c.unread_count, 0)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Contact Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {(client.address || client.city) && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span>
                            {client.address && <>{client.address}<br /></>}
                            {client.city}, {client.state} {client.zip_code}
                          </span>
                        </div>
                      )}
                      {client.website && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {client.website}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Primary Contact */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Primary Contact</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {primaryContact ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {primaryContact.first_name[0]}{primaryContact.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{primaryContact.first_name} {primaryContact.last_name}</p>
                            {primaryContact.title && (
                              <p className="text-sm text-muted-foreground">{primaryContact.title}</p>
                            )}
                            {primaryContact.email && (
                              <p className="text-sm text-primary">{primaryContact.email}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          <p>No primary contact set</p>
                          <Button variant="link" className="p-0 h-auto text-primary" onClick={() => setShowAddContact(true)}>
                            Add a contact
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Business Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Business Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {client.business_structure && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Structure</span>
                          <span className="font-medium capitalize">{client.business_structure.replace("_", " ")}</span>
                        </div>
                      )}
                      {client.industry && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Industry</span>
                          <span className="font-medium">{client.industry}</span>
                        </div>
                      )}
                      {client.ein_tin && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">EIN/TIN</span>
                          <span className="font-medium font-mono">***-**-{client.ein_tin.slice(-4)}</span>
                        </div>
                      )}
                      {client.fiscal_year_end && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fiscal Year End</span>
                          <span className="font-medium">{format(parseISO(client.fiscal_year_end), "MMMM d")}</span>
                        </div>
                      )}
                      {client.billing_rate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billing Rate</span>
                          <span className="font-medium">${client.billing_rate}/hr</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Active Services */}
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Active Services</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowAddService(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Service
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {activeServices.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeServices.map(service => (
                          <Badge key={service.id} variant="secondary" className="px-3 py-1.5">
                            <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                            {service.service_name}
                            {service.fee_amount && (
                              <span className="ml-2 text-muted-foreground">
                                ${service.fee_amount.toLocaleString()}
                                {service.fee_type === "hourly" && "/hr"}
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active services</p>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Deadlines */}
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
                    <Button variant="link" size="sm" onClick={() => setActiveTab("deadlines")}>
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {upcomingDeadlines.length > 0 ? (
                      <div className="space-y-2">
                        {upcomingDeadlines.map(deadline => (
                          <div key={deadline.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{deadline.title}</p>
                                <p className="text-xs text-muted-foreground">{deadline.deadline_type}</p>
                              </div>
                            </div>
                            <Badge
                              variant={new Date(deadline.due_date) < new Date() ? "destructive" : "secondary"}
                              className={
                                new Date(deadline.due_date) >= new Date() &&
                                new Date(deadline.due_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  : ""
                              }
                            >
                              {format(parseISO(deadline.due_date), "MMM d, yyyy")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Notes */}
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Recent Notes</CardTitle>
                    <Button variant="link" size="sm" onClick={() => setActiveTab("notes")}>
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {notes.slice(0, 3).length > 0 ? (
                      <div className="space-y-3">
                        {notes.slice(0, 3).map(note => {
                          const noteType = noteTypes.find(t => t.value === note.note_type);
                          const NoteIcon = noteType?.icon || StickyNote;
                          return (
                            <div key={note.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                              <div className={cn("p-1.5 rounded", noteType?.color || "bg-slate-100")}>
                                <NoteIcon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                {note.subject && <p className="text-sm font-medium">{note.subject}</p>}
                                <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {note.user?.full_name} • {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">Notes Timeline</h2>
                    <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter}>
                      <SelectTrigger className="w-[150px] h-8">
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        <SelectValue placeholder="Filter type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {noteTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-3.5 w-3.5" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => setShowAddNote(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Note
                  </Button>
                </div>

                {notes.length === 0 ? (
                  <Card className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No notes yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add a note to keep track of important information about this client.
                    </p>
                    <Button onClick={() => setShowAddNote(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add First Note
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {noteGroups.map(group => (
                      <div key={group.label}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-medium text-muted-foreground tracking-wider">
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="space-y-3">
                          {group.notes.map(note => {
                            const noteType = noteTypes.find(t => t.value === note.note_type);
                            const NoteIcon = noteType?.icon || StickyNote;
                            return (
                              <Card key={note.id} className={cn(
                                "transition-colors",
                                note.is_pinned && "border-primary/30 bg-primary/5"
                              )}>
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className={cn("p-2 rounded-lg", noteType?.color || "bg-slate-100")}>
                                      <NoteIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          {note.subject && (
                                            <h4 className="font-medium">{note.subject}</h4>
                                          )}
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                            <span>{note.user?.full_name || "Unknown"}</span>
                                            <span>•</span>
                                            <span>{format(parseISO(note.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                                            {note.is_pinned && (
                                              <>
                                                <span>•</span>
                                                <Pin className="h-3 w-3 text-primary" />
                                              </>
                                            )}
                                            {note.is_private && (
                                              <>
                                                <span>•</span>
                                                <Badge variant="outline" className="text-[10px] px-1">Private</Badge>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleTogglePin(note.id, note.is_pinned)}>
                                              {note.is_pinned ? (
                                                <>
                                                  <PinOff className="h-4 w-4 mr-2" />
                                                  Unpin
                                                </>
                                              ) : (
                                                <>
                                                  <Pin className="h-4 w-4 mr-2" />
                                                  Pin
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              className="text-destructive"
                                              onClick={() => handleDeleteNote(note.id)}
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      <p className="text-sm mt-2 whitespace-pre-wrap">{note.content}</p>
                                      {note.follow_up_date && !note.follow_up_completed && (
                                        <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
                                          <Clock className="h-3.5 w-3.5" />
                                          Follow-up: {format(parseISO(note.follow_up_date), "MMM d, yyyy")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Contacts ({contacts.length})</h2>
                  <Button onClick={() => setShowAddContact(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Contact
                  </Button>
                </div>

                {contacts.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No contacts yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add contacts to keep track of people associated with this client.
                    </p>
                    <Button onClick={() => setShowAddContact(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add First Contact
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contacts.map(contact => (
                      <Card key={contact.id} className={cn(
                        contact.is_primary && "border-primary/30"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {contact.first_name[0]}{contact.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {contact.first_name} {contact.last_name}
                                  {contact.is_primary && (
                                    <Badge variant="secondary" className="ml-2 text-[10px]">Primary</Badge>
                                  )}
                                </p>
                                {contact.title && (
                                  <p className="text-sm text-muted-foreground">{contact.title}</p>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!contact.is_primary && (
                                  <DropdownMenuItem onClick={() => handleSetPrimaryContact(contact.id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Set as Primary
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteContact(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="mt-3 space-y-1.5 text-sm">
                            {contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.mobile && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{contact.mobile} (mobile)</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {contact.is_authorized_signer && (
                              <Badge variant="outline" className="text-[10px]">Authorized Signer</Badge>
                            )}
                            {contact.receives_tax_docs && (
                              <Badge variant="outline" className="text-[10px]">Tax Docs</Badge>
                            )}
                            {contact.receives_invoices && (
                              <Badge variant="outline" className="text-[10px]">Invoices</Badge>
                            )}
                          </div>
                          {(contact.phone || contact.mobile) && (
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleSendSMS(contact)}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send SMS
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Services Tab */}
              <TabsContent value="services" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Services ({services.length})</h2>
                  <Button onClick={() => setShowAddService(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Service
                  </Button>
                </div>

                {services.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No services yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add services to track what you provide to this client.
                    </p>
                    <Button onClick={() => setShowAddService(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add First Service
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {services.map(service => (
                      <Card key={service.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Briefcase className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">{service.service_name}</h3>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {service.service_type.replace(/_/g, " ")}
                                  {service.frequency !== "one_time" && ` • ${service.frequency}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={service.status === "active" ? "default" : "secondary"} className="capitalize">
                                {service.status}
                              </Badge>
                              {service.fee_amount && (
                                <span className="text-sm font-medium">
                                  ${service.fee_amount.toLocaleString()}
                                  {service.fee_type === "hourly" && "/hr"}
                                </span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {service.status === "active" && (
                                    <DropdownMenuItem onClick={() => handleUpdateServiceStatus(service.id, "completed")}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark Completed
                                    </DropdownMenuItem>
                                  )}
                                  {service.status === "completed" && (
                                    <DropdownMenuItem onClick={() => handleUpdateServiceStatus(service.id, "active")}>
                                      <Clock className="h-4 w-4 mr-2" />
                                      Reactivate
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteService(service.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-3">{service.description}</p>
                          )}
                          {(service.start_date || service.tax_year) && (
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              {service.start_date && (
                                <span>Started: {format(parseISO(service.start_date), "MMM d, yyyy")}</span>
                              )}
                              {service.tax_year && (
                                <span>Tax Year: {service.tax_year}</span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tax History Tab */}
              <TabsContent value="tax-history" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Tax Filing History</h2>
                  <Button onClick={() => setShowAddFiling(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Filing
                  </Button>
                </div>

                {taxFilings.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No tax filings yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Track tax returns and their status for this client.
                    </p>
                    <Button onClick={() => setShowAddFiling(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add First Filing
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Group by tax year */}
                    {Array.from(new Set(taxFilings.map(f => f.tax_year))).sort((a, b) => b - a).map(year => (
                      <div key={year}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Tax Year {year}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {taxFilings.filter(f => f.tax_year === year).map(filing => {
                            const statusConfig = filingStatuses.find(s => s.value === filing.status);
                            return (
                              <Card key={filing.id}>
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="font-medium">{filing.filing_type}</h4>
                                      <Badge variant="secondary" className={cn("mt-1", statusConfig?.color)}>
                                        {statusConfig?.label || filing.status}
                                      </Badge>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {filing.status !== "filed" && filing.status !== "accepted" && (
                                          <DropdownMenuItem onClick={() => handleUpdateFilingStatus(filing.id, "in_progress")}>
                                            <Clock className="h-4 w-4 mr-2" />
                                            Mark In Progress
                                          </DropdownMenuItem>
                                        )}
                                        {filing.status === "in_progress" && (
                                          <DropdownMenuItem onClick={() => handleUpdateFilingStatus(filing.id, "filed")}>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Mark as Filed
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => handleDeleteFiling(filing.id)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                    {filing.due_date && (
                                      <div>
                                        <span className="text-muted-foreground">Due: </span>
                                        <span>{format(parseISO(filing.due_date), "MMM d, yyyy")}</span>
                                      </div>
                                    )}
                                    {filing.filed_date && (
                                      <div>
                                        <span className="text-muted-foreground">Filed: </span>
                                        <span>{format(parseISO(filing.filed_date), "MMM d, yyyy")}</span>
                                      </div>
                                    )}
                                    {filing.refund_amount && (
                                      <div className="text-green-600">
                                        Refund: ${filing.refund_amount.toLocaleString()}
                                      </div>
                                    )}
                                    {filing.amount_owed && (
                                      <div className="text-red-600">
                                        Owed: ${filing.amount_owed.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                  {filing.document_progress && filing.document_progress.total > 0 && (
                                    <div className="mt-3">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Documents</span>
                                        <span>{filing.document_progress.received}/{filing.document_progress.total}</span>
                                      </div>
                                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary rounded-full transition-all"
                                          style={{ width: `${(filing.document_progress.received / filing.document_progress.total) * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Deadlines Tab */}
              <TabsContent value="deadlines" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Deadlines</h2>
                  <Button onClick={() => setShowAddDeadline(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Deadline
                  </Button>
                </div>

                {deadlines.length === 0 ? (
                  <Card className="p-8 text-center">
                    <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No deadlines</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add deadlines to track important dates for this client.
                    </p>
                    <Button onClick={() => setShowAddDeadline(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add First Deadline
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {deadlines.map(deadline => {
                      const dueDate = parseISO(deadline.due_date);
                      const isPast = dueDate < new Date();
                      const isUrgent = dueDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                      return (
                        <Card key={deadline.id} className={cn(
                          isPast && deadline.status !== "completed" && "border-red-200 bg-red-50"
                        )}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  isPast && deadline.status !== "completed" ? "bg-red-100" :
                                  isUrgent ? "bg-amber-100" : "bg-slate-100"
                                )}>
                                  <CalendarDays className={cn(
                                    "h-5 w-5",
                                    isPast && deadline.status !== "completed" ? "text-red-600" :
                                    isUrgent ? "text-amber-600" : "text-slate-600"
                                  )} />
                                </div>
                                <div>
                                  <h4 className="font-medium">{deadline.title}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {deadline.deadline_type}
                                    {deadline.tax_year && ` • Tax Year ${deadline.tax_year}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    deadline.status === "completed" ? "default" :
                                    isPast ? "destructive" : "secondary"
                                  }
                                  className={
                                    deadline.status !== "completed" && !isPast && isUrgent
                                      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                      : ""
                                  }
                                >
                                  {format(dueDate, "MMM d, yyyy")}
                                </Badge>
                                <Checkbox
                                  checked={deadline.status === "completed"}
                                  onCheckedChange={() => handleToggleDeadline(deadline.id, deadline.status)}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteDeadline(deadline.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            {deadline.description && (
                              <p className="text-sm text-muted-foreground mt-2">{deadline.description}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Activity Timeline</h2>
                  <Button variant="outline" size="sm" onClick={loadActivity}>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Refresh
                  </Button>
                </div>

                {activities.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No activity yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Activity will appear here as you interact with this client.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activities.map(activity => {
                      const activityIcons: Record<string, typeof StickyNote> = {
                        note: StickyNote,
                        call: PhoneCall,
                        meeting: Video,
                        email_sent: MailOpen,
                        email_received: Mail,
                        service: Briefcase,
                        tax_filing: Receipt,
                      };
                      const ActivityIcon = activityIcons[activity.type] || Clock;
                      return (
                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
                          <div className="p-1.5 rounded bg-muted">
                            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.user?.full_name && `${activity.user.full_name} • `}
                              {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* SMS Tab */}
              <TabsContent value="sms" className="m-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">SMS Communications</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadSmsConversations}>
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => router.push('/sms')}>
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      Open SMS Hub
                    </Button>
                  </div>
                </div>

                {loadingSms ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1">
                              <Skeleton className="h-4 w-32 mb-2" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : smsConversations.length === 0 ? (
                  <Card className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No SMS conversations yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start messaging by clicking &quot;Send SMS&quot; on any contact with a phone number.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {smsConversations.map(conversation => {
                      const messages = smsMessages[conversation.id] || [];
                      const contact = contacts.find(c => c.id === conversation.contact_id);

                      return (
                        <Card key={conversation.id} className="overflow-hidden">
                          <CardHeader className="pb-2 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {conversation.contact.first_name[0]}{conversation.contact.last_name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <CardTitle className="text-base">
                                    {conversation.contact.first_name} {conversation.contact.last_name}
                                    {conversation.unread_count > 0 && (
                                      <Badge variant="destructive" className="ml-2 text-[10px]">
                                        {conversation.unread_count} new
                                      </Badge>
                                    )}
                                  </CardTitle>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {conversation.phone_number}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => contact && handleSendSMS(contact)}
                              >
                                <MessageSquare className="h-4 w-4 mr-1.5" />
                                Reply
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            {messages.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No messages in this conversation yet.
                              </p>
                            ) : (
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {messages.slice(-10).map(message => (
                                  <div
                                    key={message.id}
                                    className={cn(
                                      "flex",
                                      message.direction === "outbound" ? "justify-end" : "justify-start"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "max-w-[80%] rounded-lg px-3 py-2",
                                        message.direction === "outbound"
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted"
                                      )}
                                    >
                                      <p className="text-sm">{message.body}</p>
                                      <p className={cn(
                                        "text-[10px] mt-1",
                                        message.direction === "outbound"
                                          ? "text-primary-foreground/70"
                                          : "text-muted-foreground"
                                      )}>
                                        {format(parseISO(message.created_at), "MMM d, h:mm a")}
                                        {message.direction === "outbound" && message.status === "delivered" && (
                                          <CheckCheck className="h-3 w-3 inline ml-1" />
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {messages.length > 10 && (
                              <div className="text-center mt-3">
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => contact && handleSendSMS(contact)}
                                >
                                  View all {messages.length} messages →
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </main>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note for {client.name}. Notes are timestamped and visible to team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Note Type</label>
                <Select
                  value={noteForm.note_type}
                  onValueChange={(value) => setNoteForm({ ...noteForm, note_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {noteTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject (optional)</label>
                <Input
                  placeholder="Brief subject..."
                  value={noteForm.subject}
                  onChange={(e) => setNoteForm({ ...noteForm, subject: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Note</label>
              <Textarea
                placeholder="Enter your note here..."
                className="min-h-[120px]"
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pin-note"
                  checked={noteForm.is_pinned}
                  onCheckedChange={(checked) => setNoteForm({ ...noteForm, is_pinned: !!checked })}
                />
                <label htmlFor="pin-note" className="text-sm">Pin this note</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="private-note"
                  checked={noteForm.is_private}
                  onCheckedChange={(checked) => setNoteForm({ ...noteForm, is_private: !!checked })}
                />
                <label htmlFor="private-note" className="text-sm">Private (only visible to me)</label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Follow-up Date (optional)</label>
              <Input
                type="date"
                value={noteForm.follow_up_date}
                onChange={(e) => setNoteForm({ ...noteForm, follow_up_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!noteForm.content.trim()}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact for {client.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-first-name">First Name *</Label>
                <Input
                  id="contact-first-name"
                  placeholder="First name"
                  value={contactForm.first_name}
                  onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-last-name">Last Name *</Label>
                <Input
                  id="contact-last-name"
                  placeholder="Last name"
                  value={contactForm.last_name}
                  onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-title">Title/Position</Label>
              <Input
                id="contact-title"
                placeholder="e.g., Owner, CFO, Accountant"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="email@example.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="(555) 123-4567"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-mobile">Mobile</Label>
                <Input
                  id="contact-mobile"
                  placeholder="(555) 123-4567"
                  value={contactForm.mobile}
                  onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm text-muted-foreground">Contact Settings</Label>
              <div className="flex items-center justify-between">
                <Label htmlFor="contact-primary" className="text-sm font-normal">Primary Contact</Label>
                <Checkbox
                  id="contact-primary"
                  checked={contactForm.is_primary}
                  onCheckedChange={(checked) => setContactForm({ ...contactForm, is_primary: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="contact-signer" className="text-sm font-normal">Authorized Signer</Label>
                <Checkbox
                  id="contact-signer"
                  checked={contactForm.is_authorized_signer}
                  onCheckedChange={(checked) => setContactForm({ ...contactForm, is_authorized_signer: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="contact-tax-docs" className="text-sm font-normal">Receives Tax Documents</Label>
                <Checkbox
                  id="contact-tax-docs"
                  checked={contactForm.receives_tax_docs}
                  onCheckedChange={(checked) => setContactForm({ ...contactForm, receives_tax_docs: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="contact-invoices" className="text-sm font-normal">Receives Invoices</Label>
                <Checkbox
                  id="contact-invoices"
                  checked={contactForm.receives_invoices}
                  onCheckedChange={(checked) => setContactForm({ ...contactForm, receives_invoices: !!checked })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                placeholder="Additional notes about this contact..."
                rows={2}
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddContact}
              disabled={submittingContact || !contactForm.first_name.trim() || !contactForm.last_name.trim()}
            >
              {submittingContact ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Add a new service for {client.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="service-type">Service Type</Label>
              <Select
                value={serviceForm.service_type}
                onValueChange={(value) => setServiceForm({ ...serviceForm, service_type: value })}
              >
                <SelectTrigger id="service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax_preparation">Tax Preparation</SelectItem>
                  <SelectItem value="bookkeeping">Bookkeeping</SelectItem>
                  <SelectItem value="payroll">Payroll</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="planning">Tax Planning</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-name">Service Name *</Label>
              <Input
                id="service-name"
                placeholder="e.g., 2024 Personal Tax Return"
                value={serviceForm.service_name}
                onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                placeholder="Details about this service..."
                rows={2}
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-frequency">Frequency</Label>
                <Select
                  value={serviceForm.frequency}
                  onValueChange={(value) => setServiceForm({ ...serviceForm, frequency: value })}
                >
                  <SelectTrigger id="service-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-status">Status</Label>
                <Select
                  value={serviceForm.status}
                  onValueChange={(value) => setServiceForm({ ...serviceForm, status: value })}
                >
                  <SelectTrigger id="service-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-fee-type">Fee Type</Label>
                <Select
                  value={serviceForm.fee_type}
                  onValueChange={(value) => setServiceForm({ ...serviceForm, fee_type: value })}
                >
                  <SelectTrigger id="service-fee-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-fee-amount">Fee Amount ($)</Label>
                <Input
                  id="service-fee-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={serviceForm.fee_amount}
                  onChange={(e) => setServiceForm({ ...serviceForm, fee_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-start-date">Start Date</Label>
                <Input
                  id="service-start-date"
                  type="date"
                  value={serviceForm.start_date}
                  onChange={(e) => setServiceForm({ ...serviceForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-tax-year">Tax Year</Label>
                <Input
                  id="service-tax-year"
                  type="number"
                  placeholder="2024"
                  value={serviceForm.tax_year}
                  onChange={(e) => setServiceForm({ ...serviceForm, tax_year: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddService(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddService}
              disabled={submittingService || !serviceForm.service_name.trim()}
            >
              {submittingService ? "Adding..." : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Filing Dialog */}
      <Dialog open={showAddFiling} onOpenChange={setShowAddFiling}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Tax Filing</DialogTitle>
            <DialogDescription>
              Add a tax filing for {client.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filing-tax-year">Tax Year *</Label>
                <Input
                  id="filing-tax-year"
                  type="number"
                  placeholder="2024"
                  value={filingForm.tax_year}
                  onChange={(e) => setFilingForm({ ...filingForm, tax_year: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filing-type">Filing Type *</Label>
                <Select
                  value={filingForm.filing_type}
                  onValueChange={(value) => setFilingForm({ ...filingForm, filing_type: value })}
                >
                  <SelectTrigger id="filing-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1040">1040 - Personal</SelectItem>
                    <SelectItem value="1120">1120 - C Corporation</SelectItem>
                    <SelectItem value="1120S">1120S - S Corporation</SelectItem>
                    <SelectItem value="1065">1065 - Partnership</SelectItem>
                    <SelectItem value="990">990 - Non-Profit</SelectItem>
                    <SelectItem value="941">941 - Quarterly Payroll</SelectItem>
                    <SelectItem value="940">940 - Annual FUTA</SelectItem>
                    <SelectItem value="state">State Return</SelectItem>
                    <SelectItem value="extension">Extension</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filing-status">Status</Label>
                <Select
                  value={filingForm.status}
                  onValueChange={(value) => setFilingForm({ ...filingForm, status: value })}
                >
                  <SelectTrigger id="filing-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="docs_requested">Documents Requested</SelectItem>
                    <SelectItem value="docs_received">Documents Received</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="ready_to_file">Ready to File</SelectItem>
                    <SelectItem value="filed">Filed</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="amended">Amended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filing-due-date">Due Date</Label>
                <Input
                  id="filing-due-date"
                  type="date"
                  value={filingForm.due_date}
                  onChange={(e) => setFilingForm({ ...filingForm, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filing-notes">Notes</Label>
              <Textarea
                id="filing-notes"
                placeholder="Additional notes about this filing..."
                rows={3}
                value={filingForm.notes}
                onChange={(e) => setFilingForm({ ...filingForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFiling(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddFiling}
              disabled={submittingFiling || !filingForm.filing_type}
            >
              {submittingFiling ? "Adding..." : "Add Tax Filing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deadline Dialog */}
      <Dialog open={showAddDeadline} onOpenChange={setShowAddDeadline}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Deadline</DialogTitle>
            <DialogDescription>
              Add a deadline for {client.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deadline-type">Deadline Type</Label>
              <Select
                value={deadlineForm.deadline_type}
                onValueChange={(value) => setDeadlineForm({ ...deadlineForm, deadline_type: value })}
              >
                <SelectTrigger id="deadline-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax_filing">Tax Filing</SelectItem>
                  <SelectItem value="document_request">Document Request</SelectItem>
                  <SelectItem value="payment">Payment Due</SelectItem>
                  <SelectItem value="extension">Extension</SelectItem>
                  <SelectItem value="estimated_payment">Estimated Payment</SelectItem>
                  <SelectItem value="meeting">Meeting/Appointment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline-title">Title *</Label>
              <Input
                id="deadline-title"
                placeholder="e.g., 2024 Tax Return Due"
                value={deadlineForm.title}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deadline-due-date">Due Date *</Label>
                <Input
                  id="deadline-due-date"
                  type="date"
                  value={deadlineForm.due_date}
                  onChange={(e) => setDeadlineForm({ ...deadlineForm, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline-tax-year">Tax Year</Label>
                <Input
                  id="deadline-tax-year"
                  type="number"
                  placeholder="2024"
                  value={deadlineForm.tax_year}
                  onChange={(e) => setDeadlineForm({ ...deadlineForm, tax_year: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline-description">Description</Label>
              <Textarea
                id="deadline-description"
                placeholder="Additional details about this deadline..."
                rows={3}
                value={deadlineForm.description}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeadline(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddDeadline}
              disabled={submittingDeadline || !deadlineForm.title.trim() || !deadlineForm.due_date}
            >
              {submittingDeadline ? "Adding..." : "Add Deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
