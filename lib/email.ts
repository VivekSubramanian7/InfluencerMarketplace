import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Clipline <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
  } catch (err) {
    console.error("sendEmail failed:", err);
  }
}

export async function emailUser(opts: {
  userId: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const service = createServiceClient();
    const { data } = await service.auth.admin.getUserById(opts.userId);
    const to = data.user?.email;
    if (!to) return;
    await sendEmail({ to, subject: opts.subject, text: opts.text });
  } catch (err) {
    console.error("emailUser failed:", err);
  }
}
