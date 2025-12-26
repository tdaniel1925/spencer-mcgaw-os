import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Spencer McGaw CPA Hub",
  description: "Privacy Policy for Spencer McGaw CPA Hub",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "December 25, 2025";
  const companyName = "Spencer McGaw CPA";
  const appName = "Spencer McGaw CPA Hub";

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                {companyName} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting the
                privacy of our employees and clients. This Privacy Policy explains
                how we collect, use, and safeguard information in {appName}.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect the following types of information:
              </p>
              <h3 className="text-base font-medium mt-4">Employee Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Name and email address</li>
                <li>Login credentials and authentication data</li>
                <li>Activity logs and usage data</li>
                <li>Task assignments and work history</li>
              </ul>
              <h3 className="text-base font-medium mt-4">Client Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Contact information (name, address, phone, email)</li>
                <li>Tax identification numbers</li>
                <li>Financial documents and records</li>
                <li>Communication history</li>
                <li>Service history and notes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. How We Use Information</h2>
              <p className="text-muted-foreground">We use collected information to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide and improve our CPA services</li>
                <li>Manage client relationships and communications</li>
                <li>Process and prepare tax documents</li>
                <li>Facilitate internal team collaboration</li>
                <li>Maintain audit trails for compliance</li>
                <li>Ensure security and prevent unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Encrypted data storage</li>
                <li>Role-based access controls</li>
                <li>Regular security audits</li>
                <li>Secure authentication practices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain data in accordance with legal requirements and professional
                standards for CPAs. Tax-related documents are retained for a minimum
                of 7 years. You may request deletion of non-essential data by contacting
                administration.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Third-Party Services</h2>
              <p className="text-muted-foreground">We use the following third-party services:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>
                  <strong>Supabase</strong> - Database and authentication
                </li>
                <li>
                  <strong>Vercel</strong> - Application hosting
                </li>
                <li>
                  <strong>GoTo Connect</strong> - Phone system integration
                </li>
                <li>
                  <strong>Microsoft 365</strong> - Email integration
                </li>
                <li>
                  <strong>Twilio</strong> - SMS and caller ID services
                </li>
                <li>
                  <strong>OpenAI</strong> - AI-powered document analysis
                </li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Each service has its own privacy policy governing their handling of data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Your Rights</h2>
              <p className="text-muted-foreground">You have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of non-essential data</li>
                <li>Receive a copy of your data in a portable format</li>
                <li>Withdraw consent where applicable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Professional Confidentiality</h2>
              <p className="text-muted-foreground">
                As CPAs, we are bound by professional ethics and confidentiality
                requirements. Client information is protected by CPA-client privilege
                and will not be disclosed except as required by law or with client consent.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy periodically. Material changes will
                be communicated to users. Continued use of the Service constitutes
                acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact Us</h2>
              <p className="text-muted-foreground">
                For questions about this Privacy Policy or to exercise your data rights,
                please contact your system administrator or email us directly.
              </p>
            </section>

            <div className="pt-6 border-t flex gap-4">
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
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
