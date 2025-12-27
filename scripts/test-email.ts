/**
 * Quick test script for Resend email
 * Run with: npx tsx scripts/test-email.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function testEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "notifications@spencermcgaw.com";
  const emailTo = "tdaniel@bundlefly.com";

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("📧 Sending test email...");
  console.log(`   From: ${emailFrom}`);
  console.log(`   To: ${emailTo}`);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: emailTo,
      subject: "Test Email - Spencer McGaw Hub",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Spencer McGaw Hub</h1>
          </div>
          <div style="padding: 30px; background: white;">
            <h2>✅ Test Email Successful!</h2>
            <p>Your email notification system is working correctly.</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            This is a test email from Spencer McGaw Hub.
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Failed to send:", error.message);
      process.exit(1);
    }

    console.log("✅ Email sent successfully!");
    console.log(`   Email ID: ${data?.id}`);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

testEmail();
