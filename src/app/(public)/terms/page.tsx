import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Spencer McGaw CPA Hub",
  description: "Terms of Service for Spencer McGaw CPA Hub",
};

export default function TermsOfServicePage() {
  const lastUpdated = "December 25, 2025";
  const companyName = "Spencer McGaw CPA";
  const appName = "Spencer McGaw CPA Hub";

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using {appName} (the &quot;Service&quot;), you accept and agree to be
                bound by the terms and provision of this agreement. If you do not agree to
                abide by these terms, please do not use this Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                {appName} is a business operating system designed for internal use by {companyName}{" "}
                and its authorized employees. The Service provides tools for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Client relationship management (CRM)</li>
                <li>Task and project management</li>
                <li>Communication management (calls, emails, SMS)</li>
                <li>Document intake and processing</li>
                <li>Team collaboration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. User Accounts</h2>
              <p className="text-muted-foreground">
                To access the Service, you must be provided with login credentials by
                an administrator. You are responsible for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying administration immediately of any unauthorized use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Acceptable Use</h2>
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Share your login credentials with unauthorized persons</li>
                <li>Access data or accounts you are not authorized to access</li>
                <li>Attempt to circumvent security measures</li>
                <li>Use the Service for any unlawful purpose</li>
                <li>Upload malicious code or content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Data and Privacy</h2>
              <p className="text-muted-foreground">
                The Service processes sensitive client information. All users must
                comply with our{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{" "}
                and applicable data protection regulations including professional
                confidentiality requirements for CPAs.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of the Service are owned by
                {companyName} and are protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Termination</h2>
              <p className="text-muted-foreground">
                Access to the Service may be terminated at any time by administration.
                Upon termination, you must cease all use of the Service immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                The Service is provided &quot;as is&quot; without warranties of any kind. {companyName}{" "}
                shall not be liable for any indirect, incidental, or consequential damages
                arising from use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use
                of the Service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact your
                system administrator.
              </p>
            </section>

            <div className="pt-6 border-t">
              <Link href="/login" className="text-primary hover:underline">
                &larr; Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
