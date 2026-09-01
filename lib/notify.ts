import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// One entry point for user-facing notifications: always writes the in-app
// row; optionally emails (best-effort — a mail failure never fails the
// calling action). Email is skipped entirely when RESEND_API_KEY is unset.

export interface Notification {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  email?: boolean;
}

export async function notify(n: Notification): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("notifications").insert({
      user_id: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    });

    if (n.email && process.env.RESEND_API_KEY) {
      const { data } = await service.auth.admin.getUserById(n.userId);
      const to = data.user?.email;
      if (to) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Clipline <onboarding@resend.dev>",
          to,
          subject: n.title,
          text:
            (n.body ? n.body + "\n\n" : "") +
            (n.href ? `Open it on Clipline: ${site}${n.href}` : site),
        });
      }
    }
  } catch (err) {
    // notifications are best-effort — never break the action that triggered them
    console.error("notify failed:", err);
  }
}

export async function notifyAll(list: Notification[]): Promise<void> {
  await Promise.all(list.map(notify));
}
