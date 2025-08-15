import Mailgun from "mailgun.js";
import FormData from "form-data";
import { algoricumGoLiveTemplate } from "./ConfirmationMail";

export async function sendGoLiveEmail({
  name,
  email,
  dashboardUrl,
}: {
  name: string;
  email: string;
  dashboardUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY || "",
    });

    const { html, text } = algoricumGoLiveTemplate({ name, dashboardUrl });

    const mailData = {
      from: `Algoricum <no-reply@algoricum.com>`,
      to: [email],
      subject: "Congrats! Algoricum is live for your clinic",
      html,
      text,
    };

    await mg.messages.create(process.env.MAILGUN_DOMAIN || "", mailData);

    return { success: true };
  } catch (error) {
    console.error("Mailgun sendGoLiveEmail failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
