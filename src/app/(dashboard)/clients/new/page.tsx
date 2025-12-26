"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, User, Building, MapPin, Phone, Mail, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormProgress, useFormProgress } from "@/components/ui/form-progress";
import { toast } from "sonner";

const serviceTypes = [
  { id: "tax-prep", label: "Tax Preparation" },
  { id: "bookkeeping", label: "Bookkeeping" },
  { id: "payroll", label: "Payroll Services" },
  { id: "consulting", label: "Consulting" },
  { id: "audit", label: "Audit & Assurance" },
  { id: "planning", label: "Tax Planning" },
];

const formSteps = [
  { id: "type", label: "Client Type" },
  { id: "info", label: "Basic Information" },
  { id: "address", label: "Address" },
  { id: "services", label: "Services" },
  { id: "assignment", label: "Assignment" },
];

interface FormData {
  clientType: "individual" | "business";
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  services: string[];
  assignee: string;
  notes: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    clientType: "individual",
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    services: [],
    assignee: "",
    notes: "",
  });
  const { currentStep, nextStep, prevStep, isFirstStep, isLastStep } = useFormProgress({
    totalSteps: formSteps.length,
  });

  // Helper to update form data
  const updateField = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Refs for each section to enable auto-scroll
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleService = (serviceId: string) => {
    const newServices = formData.services.includes(serviceId)
      ? formData.services.filter((id) => id !== serviceId)
      : [...formData.services, serviceId];
    updateField("services", newServices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setSaving(true);
    try {
      // Build the name field
      const name = formData.clientType === "business" && formData.companyName
        ? `${formData.companyName} (${formData.firstName} ${formData.lastName})`
        : `${formData.firstName} ${formData.lastName}`;

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: formData.email,
          phone: formData.phone,
          address: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          status: "active",
          notes: formData.notes,
          tags: formData.services,
        }),
      });

      if (response.ok) {
        toast.success("Client created successfully");
        router.push("/clients");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to create client");
      }
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  // Scroll to the current step section
  useEffect(() => {
    const ref = sectionRefs.current[currentStep];
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentStep]);

  const handleNextStep = () => {
    // TODO: Add validation before moving to next step
    nextStep();
  };

  return (
    <>
      <Header title="Add New Client" />
      <main className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/clients"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Link>
        </div>

        {/* Form Progress Indicator */}
        <div className="mb-8 max-w-5xl 2xl:max-w-6xl">
          <FormProgress steps={formSteps} currentStep={currentStep} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl 2xl:max-w-6xl">
          {/* Client Type - Step 0 */}
          <div ref={(el) => { sectionRefs.current[0] = el; }}>
          <Card className={currentStep === 0 ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Type
              </CardTitle>
              <CardDescription>
                Select whether this is an individual or business client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.clientType === "individual" ? "default" : "outline"}
                  className={formData.clientType === "individual" ? "bg-primary" : ""}
                  onClick={() => updateField("clientType", "individual")}
                >
                  <User className="h-4 w-4 mr-2" />
                  Individual
                </Button>
                <Button
                  type="button"
                  variant={formData.clientType === "business" ? "default" : "outline"}
                  className={formData.clientType === "business" ? "bg-primary" : ""}
                  onClick={() => updateField("clientType", "business")}
                >
                  <Building className="h-4 w-4 mr-2" />
                  Business
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Basic Information - Step 1 */}
          <div ref={(el) => { sectionRefs.current[1] = el; }}>
          <Card className={currentStep === 1 ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Enter the client&apos;s contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.clientType === "business" && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Enter company name"
                    value={formData.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter phone number"
                      className="pl-10"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Address - Step 2 */}
          <div ref={(el) => { sectionRefs.current[2] = el; }}>
          <Card className={currentStep === 2 ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  placeholder="Enter street address"
                  value={formData.street}
                  onChange={(e) => updateField("street", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(v) => updateField("state", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="GA">Georgia</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="CO">Colorado</SelectItem>
                      <SelectItem value="WA">Washington</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="ZIP Code"
                    value={formData.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Services - Step 3 */}
          <div ref={(el) => { sectionRefs.current[3] = el; }}>
          <Card className={currentStep === 3 ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Select the services this client needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceTypes.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={service.id}
                      checked={formData.services.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <label
                      htmlFor={service.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {service.label}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Assign To - Step 4 */}
          <div ref={(el) => { sectionRefs.current[4] = el; }}>
          <Card className={currentStep === 4 ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              <CardDescription>
                Assign this client to a team member
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="assignee">Primary Assignee</Label>
                <Select value={formData.assignee} onValueChange={(v) => updateField("assignee", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hunter">Hunter McGaw</SelectItem>
                    <SelectItem value="elizabeth">Elizabeth</SelectItem>
                    <SelectItem value="britney">Britney</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this client..."
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Actions with step navigation */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              {!isLastStep ? (
                <Button type="button" onClick={handleNextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" className="bg-primary" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? "Saving..." : "Save Client"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
