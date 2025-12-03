"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { ProgressStatCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Printer,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

// Mock data
const mockClients = [
  {
    id: "CL001",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@email.com",
    phone: "555-0101",
    companyName: "",
    city: "Austin",
    state: "TX",
    serviceTypes: ["Tax Preparation", "Consulting"],
    assignee: { name: "Hunter McGaw", avatar: "" },
    isActive: true,
    createdAt: new Date("2022-03-15"),
  },
  {
    id: "CL002",
    firstName: "ABC",
    lastName: "Corp",
    email: "contact@abccorp.com",
    phone: "555-0102",
    companyName: "ABC Corporation",
    city: "Dallas",
    state: "TX",
    serviceTypes: ["Bookkeeping", "Payroll"],
    assignee: { name: "Britney", avatar: "" },
    isActive: true,
    createdAt: new Date("2021-08-22"),
  },
  {
    id: "CL003",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@email.com",
    phone: "555-0103",
    companyName: "",
    city: "Houston",
    state: "TX",
    serviceTypes: ["Tax Preparation"],
    assignee: { name: "Elizabeth", avatar: "" },
    isActive: true,
    createdAt: new Date("2023-01-10"),
  },
  {
    id: "CL004",
    firstName: "Tech",
    lastName: "Solutions LLC",
    email: "info@techsolutions.com",
    phone: "555-0104",
    companyName: "Tech Solutions LLC",
    city: "San Antonio",
    state: "TX",
    serviceTypes: ["Bookkeeping", "Tax Preparation", "Consulting"],
    assignee: { name: "Hunter McGaw", avatar: "" },
    isActive: true,
    createdAt: new Date("2022-11-05"),
  },
  {
    id: "CL005",
    firstName: "Mike",
    lastName: "Williams",
    email: "mike.w@consulting.com",
    phone: "555-0105",
    companyName: "Williams Consulting",
    city: "Austin",
    state: "TX",
    serviceTypes: ["Tax Preparation"],
    assignee: { name: "Hunter McGaw", avatar: "" },
    isActive: false,
    createdAt: new Date("2020-06-18"),
  },
  {
    id: "CL006",
    firstName: "XYZ",
    lastName: "Inc",
    email: "accounting@xyzinc.com",
    phone: "555-0106",
    companyName: "XYZ Incorporated",
    city: "Fort Worth",
    state: "TX",
    serviceTypes: ["Payroll", "Bookkeeping"],
    assignee: { name: "Britney", avatar: "" },
    isActive: true,
    createdAt: new Date("2023-04-20"),
  },
];

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = mockClients.filter((client) => {
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    const company = client.companyName?.toLowerCase() || "";
    const email = client.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) || company.includes(query) || email.includes(query)
    );
  });

  const clientCounts = {
    total: mockClients.length,
    active: mockClients.filter((c) => c.isActive).length,
    new: mockClients.filter(
      (c) => c.createdAt > new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    ).length,
  };

  return (
    <>
      <Header title="Clients" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressStatCard
            title="Total Clients"
            value={clientCounts.total}
            progress={80}
            change={{ value: 5.2, period: "30 days" }}
            progressColor="#143009"
          />
          <ProgressStatCard
            title="Active Clients"
            value={clientCounts.active}
            progress={90}
            change={{ value: 3.1, period: "30 days" }}
            progressColor="#DBC16F"
          />
          <ProgressStatCard
            title="New This Month"
            value={clientCounts.new}
            progress={70}
            change={{ value: 12.5, period: "vs last month" }}
            progressColor="#4a7c3a"
          />
        </div>

        {/* Clients Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Client List</CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Print */}
              <Button variant="outline" size="icon">
                <Printer className="h-4 w-4" />
              </Button>

              {/* Add Client */}
              <Link href="/clients/new">
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Client ID</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const displayName = client.companyName
                    ? client.companyName
                    : `${client.firstName} ${client.lastName}`;
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-primary">
                        #{client.id}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(client.createdAt, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-accent text-accent-foreground">
                              {client.firstName[0]}
                              {client.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{displayName}</div>
                            {client.companyName && (
                              <div className="text-xs text-muted-foreground">
                                {client.firstName} {client.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {client.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-primary">
                          <Mail className="h-3.5 w-3.5" />
                          {client.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {client.city}, {client.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {client.serviceTypes.slice(0, 2).map((service) => (
                            <Badge
                              key={service}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {service}
                            </Badge>
                          ))}
                          {client.serviceTypes.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{client.serviceTypes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            client.isActive
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          )}
                        >
                          {client.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Phone className="h-4 w-4 mr-2" />
                              Call Client
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing 1 to {filteredClients.length} of {mockClients.length}{" "}
                entries
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  1
                </Button>
                <Button variant="outline" size="sm">
                  2
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
