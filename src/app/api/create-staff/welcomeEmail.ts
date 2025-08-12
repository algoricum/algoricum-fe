import FormData from "form-data";
import Mailgun from "mailgun.js";
import { emailTemplate } from "@/utils/emailTemplate";
import {EmailResult} from "@/interfaces/createStaffApi/types";

/**
 * Send welcome email with credentials using Mailgun
 */
export async function sendWelcomeEmail(email: string, name: string, password: string, clinicName: string): Promise<EmailResult> {
  try {
    // Initialize Mailgun client
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY || "",
    });

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/login`;

    // Generate beautiful email template
    const { html: emailHtml, text: textContent } = emailTemplate({
      name,
      email,
      password,
      clinicName,
      loginUrl,
    });

    // Send email using Mailgun
    const mailData = {
      from: `${clinicName} <${process.env.MAILGUN_FROM_EMAIL || "noreply@yourdomain.com"}>`,
      to: [email],
      subject: `Welcome to ${clinicName} - Your Account Details`,
      text: textContent,
      html: emailHtml,
    };

    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN || "", mailData);

    console.log("Email sent successfully:", data);

    return {
      success: true,
      method: "mailgun",
      credentials: {
        email,
        password,
        name,
      },
    };
  } catch (error) {
    console.error("Mailgun email sending failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
      credentials: {
        email,
        password,
        name,
      },
    };
  }
}
