"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Search,
  Plus,
  ChevronRight,
  Printer,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Pagination, usePagination } from "@/components/ui/pagination";

// Client type definition
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  serviceTypes: string[];
  assignee: { name: string; avatar: string };
  isActive: boolean;
  createdAt: Date;
}

// Empty clients array - real data comes from database
const clients: Client[] = [];

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const company = client.companyName?.toLowerCase() || "";
      const email = client.email.toLowerCase();
      const query = searchQuery.toLowerCase();
      return (
        fullName.includes(query) || company.includes(query) || email.includes(query)
      );
    });
  }, [searchQuery]);

  // Use pagination hook with filtered data
  const {
    paginatedData: paginatedClients,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination({
    data: filteredClients,
    initialPageSize: 5,
  });

  const clientCounts = useMemo(() => ({
    total: clients.length,
    active: clients.filter((c) => c.isActive).length,
    new: clients.filter(
      (c) => c.createdAt > new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    ).length,
  }), []);

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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search clients..."
                  aria-label="Search clients by name, company, or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Print */}
              <Button variant="outline" size="icon" aria-label="Print client list">
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
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => {
                  const displayName = client.companyName
                    ? client.companyName
                    : `${client.firstName} ${client.lastName}`;
                  return (
                    <TableRow
                      key={client.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${client.companyName || `${client.firstName} ${client.lastName}`}`}
                      className="cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      onClick={() => router.push(`/clients/${client.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/clients/${client.id}`);
                        }
                      }}
                    >
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
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20]}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
