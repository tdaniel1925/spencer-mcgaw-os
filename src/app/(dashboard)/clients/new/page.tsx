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
import { ArrowLeft, Save, User, Building, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { FormProgress, useFormProgress } from "@/components/ui/form-progress";

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

export default function NewClientPage() {
  const router = useRouter();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const { currentStep, nextStep, prevStep, isFirstStep, isLastStep, goToStep } = useFormProgress({
    totalSteps: formSteps.length,
  });

  // Refs for each section to enable auto-scroll
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit to Supabase
    router.push("/clients");
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
        <div className="mb-8 max-w-4xl">
          <FormProgress steps={formSteps} currentStep={currentStep} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
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
                  variant={clientType === "individual" ? "default" : "outline"}
                  className={clientType === "individual" ? "bg-primary" : ""}
                  onClick={() => setClientType("individual")}
                >
                  <User className="h-4 w-4 mr-2" />
                  Individual
                </Button>
                <Button
                  type="button"
                  variant={clientType === "business" ? "default" : "outline"}
                  className={clientType === "business" ? "bg-primary" : ""}
                  onClick={() => setClientType("business")}
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
              {clientType === "business" && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Enter company name"
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
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
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter phone number"
                      className="pl-10"
                      required
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
                <Input id="street" placeholder="Enter street address" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input id="zip" placeholder="ZIP Code" />
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
                      checked={selectedServices.includes(service.id)}
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
                <Select>
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
                <Button type="submit" className="bg-primary">
                  <Save className="h-4 w-4 mr-2" />
                  Save Client
                </Button>
              )}
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
