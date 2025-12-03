"use client";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Mock client data
const mockClient = {
  id: "CL001",
  firstName: "John",
  lastName: "Smith",
  email: "john.smith@email.com",
  phone: "555-0101",
  alternatePhone: "555-0199",
  companyName: "",
  address: "123 Main Street",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  taxId: "***-**-1234",
  serviceTypes: ["Tax Preparation", "Consulting"],
  assignee: { name: "Hunter McGaw", avatar: "" },
  isActive: true,
  notes: "Long-term client, prefers email communication. Tax returns typically complex due to multiple investment accounts.",
  createdAt: new Date("2022-03-15"),
};

const mockTasks = [
  {
    id: "TSK001",
    title: "Send 2023 tax return copy",
    status: "pending",
    priority: "high",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(),
  },
  {
    id: "TSK002",
    title: "Schedule annual review meeting",
    status: "completed",
    priority: "medium",
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
  },
  {
    id: "TSK003",
    title: "Process Q4 estimated payments",
    status: "in_progress",
    priority: "high",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
];

const mockCalls = [
  {
    id: "CALL001",
    direction: "inbound",
    duration: 180,
    summary: "Client called requesting copy of 2023 tax return",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "CALL002",
    direction: "outbound",
    duration: 420,
    summary: "Follow-up call regarding quarterly estimates",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
];

const mockDocuments = [
  {
    id: "DOC001",
    name: "2023 Tax Return",
    type: "tax_return",
    status: "filed",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
  {
    id: "DOC002",
    name: "W-2 Forms 2023",
    type: "w2",
    status: "received",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
  },
  {
    id: "DOC003",
    name: "Investment Summary",
    type: "other",
    status: "processing",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
];

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
};

export default function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const client = mockClient;
  const displayName = client.companyName
    ? client.companyName
    : `${client.firstName} ${client.lastName}`;

  return (
    <>
      <Header title="Client Detail" />
      <main className="p-6 space-y-6">
        {/* Client Header Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client ID Banner */}
          <Card className="bg-gradient-to-r from-accent/90 to-accent text-accent-foreground overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Client ID</p>
                <h2 className="text-3xl font-bold">#{client.id}</h2>
              </div>
              <div className="opacity-20">
                <Building className="h-20 w-20" />
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-accent">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {client.firstName[0]}
                      {client.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">{displayName}</h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-1",
                        client.isActive
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {client.isActive ? "Active Client" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{client.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-primary">{client.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {client.city}, {client.state}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Since {format(client.createdAt, "MMM yyyy")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="calls">Call History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">
                        {client.firstName} {client.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">
                        {client.companyName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Primary Phone
                      </p>
                      <p className="font-medium">{client.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Alternate Phone
                      </p>
                      <p className="font-medium">
                        {client.alternatePhone || "N/A"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {client.address}, {client.city}, {client.state}{" "}
                        {client.zipCode}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Services & Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Services & Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Active Services
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {client.serviceTypes.map((service) => (
                        <Badge
                          key={service}
                          className="bg-accent text-accent-foreground"
                        >
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Assigned To
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {client.assignee.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{client.assignee.name}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ID</p>
                    <p className="font-medium font-mono">{client.taxId}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Tasks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-normal",
                              statusConfig[task.status as keyof typeof statusConfig]
                                .className
                            )}
                          >
                            {
                              statusConfig[task.status as keyof typeof statusConfig]
                                .label
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(task.dueDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">All Tasks</CardTitle>
                <Button className="bg-primary">Add Task</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task ID</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-primary">
                          #{task.id}
                        </TableCell>
                        <TableCell>{task.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-normal",
                              statusConfig[task.status as keyof typeof statusConfig]
                                .className
                            )}
                          >
                            {
                              statusConfig[task.status as keyof typeof statusConfig]
                                .label
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(task.dueDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Documents</CardTitle>
                <Button className="bg-primary">Upload Document</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {doc.type.replace("_", " ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(doc.uploadedAt, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calls">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Call History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direction</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCalls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              call.direction === "inbound"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {call.direction === "inbound" ? "Inbound" : "Outbound"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {call.summary}
                        </TableCell>
                        <TableCell>
                          {Math.floor(call.duration / 60)}:
                          {String(call.duration % 60).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(call.timestamp, "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Notes</CardTitle>
                <Button className="bg-primary">Add Note</Button>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Client Notes
                  </p>
                  <p>{client.notes}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
