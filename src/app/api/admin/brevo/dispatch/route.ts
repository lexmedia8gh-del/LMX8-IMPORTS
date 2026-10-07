import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { sendBrevoEmail } from "@/lib/email/brevo";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession();
    const body = await request.json().catch(() => ({}));
    const recipientEmail = body?.recipientEmail?.trim();

    if (!recipientEmail || !recipientEmail.includes("@") || !recipientEmail.includes(".")) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid recipient email address is required.",
          category: "VALIDATION_ERROR",
          provider: "brevo",
        },
        { status: 400 }
      );
    }

    const subject = `LMX8 IMPORTS — Brevo Diagnostic API Test (${new Date().toLocaleTimeString()})`;
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 24px; background: #F8FAFC; border-radius: 12px; color: #172236;">
        <h2 style="color: #141B47; margin-top: 0;">LMX8 IMPORTS — Brevo API Test</h2>
        <p>This is a test email dispatched directly via the authenticated Brevo endpoint.</p>
        <p><strong>Admin:</strong> ${admin.name || admin.email}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    `;

    const result = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: admin.name || "Admin" }],
      subject,
      htmlContent,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err: any) {
    console.error("[/api/admin/brevo/dispatch] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal server error during dispatch.",
        category: "APPLICATION_ERROR",
        provider: "brevo",
      },
      { status: 500 }
    );
  }
}
