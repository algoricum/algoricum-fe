import { NextResponse } from "next/server";
import { sendGoLiveEmail } from "@/utils/sendGoLiveEmail";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/dashboard`;

    const result = await sendGoLiveEmail({ name, email, dashboardUrl });

    if (result.success) {
      return NextResponse.json({ message: "Email sent successfully" });
    } else {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
