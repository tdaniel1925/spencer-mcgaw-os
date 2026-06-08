"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField, validators, composeValidators } from "@/components/ui/form-field";
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
  { id: "defense", label: "Defense & Procurement" },
  { id: "commercial", label: "Commercial Energy" },
  { id: "research", label: "Research Collaboration" },
  { id: "consulting", label: "Engineering Consulting" },
  { id: "investor", label: "Investor Relations" },
  { id: "supply-chain", label: "Supply Chain" },
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
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
        const data = await response.json();
        const clientName = `${formData.firstName} ${formData.lastName}`.trim();
        toast.success(`Client created: ${clientName}`, {
          description: "You can now add tasks, track interactions, and manage their information",
          action: data.client?.id ? {
            label: "View Client",
            onClick: () => router.push(`/clients/${data.client.id}`)
          } : undefined,
          duration: 6000,
        });
        // Small delay before redirect to allow toast to be seen
        setTimeout(() => router.push("/clients"), 500);
      } else {
        const data = await response.json();
        const errorMessage = data.error || "Failed to create client";
        toast.error(errorMessage, {
          description: "Please check your information and try again",
          action: {
            label: "Retry",
            onClick: () => handleSubmit(new Event("submit") as any)
          },
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Network error", {
        description: "Could not connect to server. Please check your connection and try again",
        duration: 8000,
      });
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

  // Validate a specific field
  const validateField = (field: keyof FormData, value: string): string | null => {
    switch (field) {
      case "firstName":
      case "lastName":
        return validators.required(value);
      case "email":
        return composeValidators(validators.required, validators.email)(value);
      case "phone":
        if (!value) return null; // Optional field
        return validators.phone(value);
      case "zip":
        if (!value) return null; // Optional field
        return validators.zipCode(value);
      case "companyName":
        if (formData.clientType === "business") {
          return validators.required(value);
        }
        return null;
      default:
        return null;
    }
  };

  // Validate current step before moving forward
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string | null> = {};
    let hasErrors = false;

    switch (currentStep) {
      case 0: // Client Type
        // No validation needed for client type step
        break;
      case 1: // Basic Information
        const firstNameError = validateField("firstName", formData.firstName);
        const lastNameError = validateField("lastName", formData.lastName);
        const emailError = validateField("email", formData.email);
        const phoneError = validateField("phone", formData.phone);
        const companyNameError = validateField("companyName", formData.companyName);

        if (firstNameError) {
          errors.firstName = firstNameError;
          hasErrors = true;
        }
        if (lastNameError) {
          errors.lastName = lastNameError;
          hasErrors = true;
        }
        if (emailError) {
          errors.email = emailError;
          hasErrors = true;
        }
        if (phoneError) {
          errors.phone = phoneError;
          hasErrors = true;
        }
        if (companyNameError) {
          errors.companyName = companyNameError;
          hasErrors = true;
        }
        break;
      case 2: // Address
        const zipError = validateField("zip", formData.zip);
        if (zipError) {
          errors.zip = zipError;
          hasErrors = true;
        }
        break;
      case 3: // Services
      case 4: // Assignment
        // No required fields
        break;
    }

    if (hasErrors) {
      setFieldErrors(errors);
      setTouchedFields({
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        zip: true,
        companyName: true,
      });
      toast.error("Please fix the errors before continuing");
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      nextStep();
    }
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
                <FormField
                  label="Company Name"
                  name="companyName"
                  value={formData.companyName}
                  onChange={(value) => {
                    updateField("companyName", value);
                    if (touchedFields.companyName) {
                      const error = validateField("companyName", value);
                      setFieldErrors((prev) => ({ ...prev, companyName: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, companyName: true }));
                    const error = validateField("companyName", formData.companyName);
                    setFieldErrors((prev) => ({ ...prev, companyName: error }));
                  }}
                  error={touchedFields.companyName ? fieldErrors.companyName || undefined : undefined}
                  required
                  showSuccess={touchedFields.companyName && !fieldErrors.companyName && formData.companyName.length > 0}
                  placeholder="Enter company name"
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={(value) => {
                    updateField("firstName", value);
                    if (touchedFields.firstName) {
                      const error = validateField("firstName", value);
                      setFieldErrors((prev) => ({ ...prev, firstName: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, firstName: true }));
                    const error = validateField("firstName", formData.firstName);
                    setFieldErrors((prev) => ({ ...prev, firstName: error }));
                  }}
                  error={touchedFields.firstName ? fieldErrors.firstName || undefined : undefined}
                  required
                  showSuccess={touchedFields.firstName && !fieldErrors.firstName && formData.firstName.length > 0}
                  placeholder="Enter first name"
                />

                <FormField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={(value) => {
                    updateField("lastName", value);
                    if (touchedFields.lastName) {
                      const error = validateField("lastName", value);
                      setFieldErrors((prev) => ({ ...prev, lastName: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, lastName: true }));
                    const error = validateField("lastName", formData.lastName);
                    setFieldErrors((prev) => ({ ...prev, lastName: error }));
                  }}
                  error={touchedFields.lastName ? fieldErrors.lastName || undefined : undefined}
                  required
                  showSuccess={touchedFields.lastName && !fieldErrors.lastName && formData.lastName.length > 0}
                  placeholder="Enter last name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(value) => {
                    updateField("email", value);
                    if (touchedFields.email) {
                      const error = validateField("email", value);
                      setFieldErrors((prev) => ({ ...prev, email: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, email: true }));
                    const error = validateField("email", formData.email);
                    setFieldErrors((prev) => ({ ...prev, email: error }));
                  }}
                  error={touchedFields.email ? fieldErrors.email || undefined : undefined}
                  required
                  showSuccess={touchedFields.email && !fieldErrors.email && formData.email.length > 0}
                  placeholder="Enter email address"
                />

                <FormField
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(value) => {
                    updateField("phone", value);
                    if (touchedFields.phone) {
                      const error = validateField("phone", value);
                      setFieldErrors((prev) => ({ ...prev, phone: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, phone: true }));
                    const error = validateField("phone", formData.phone);
                    setFieldErrors((prev) => ({ ...prev, phone: error }));
                  }}
                  error={touchedFields.phone ? fieldErrors.phone || undefined : undefined}
                  showSuccess={touchedFields.phone && !fieldErrors.phone && formData.phone.length > 0}
                  placeholder="Enter phone number"
                  tooltipContent="Optional. Format: (555) 555-5555"
                />
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
                <div>
                  <FormField
                    label="ZIP Code"
                    name="zip"
                    value={formData.zip}
                    onChange={(value) => {
                      updateField("zip", value);
                      if (touchedFields.zip) {
                        const error = validateField("zip", value);
                        setFieldErrors((prev) => ({ ...prev, zip: error }));
                      }
                    }}
                    onBlur={() => {
                      setTouchedFields((prev) => ({ ...prev, zip: true }));
                      const error = validateField("zip", formData.zip);
                      setFieldErrors((prev) => ({ ...prev, zip: error }));
                    }}
                    error={touchedFields.zip ? fieldErrors.zip || undefined : undefined}
                    showSuccess={touchedFields.zip && !fieldErrors.zip && formData.zip.length > 0}
                    placeholder="Enter ZIP code"
                    tooltipContent="5-digit ZIP code"
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
