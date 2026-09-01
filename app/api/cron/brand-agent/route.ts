import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notify";

export const maxDuration = 300;

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const RENOTIFY_AFTER_DAYS = 7;

// Daily brand-agent sweep (vercel.json cron): finds accepted conversations
// where the creator spoke last and the brand has gone quiet for 48h+, then
// nudges the brand — one in-app notification per thread (re-nagged at most
// weekly) plus one digest email per brand per run. Detection is pure data;
// no LLM is involved here.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: conversations, error } = await service
    .from("conversations")
    .select("id, brand_id, creator_id")
    .eq("status", "accepted");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cutoff = Date.now() - STALE_AFTER_MS;
  const renotifyCutoff = new Date(
    Date.now() - RENOTIFY_AFTER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // ponytail: one last-message query per accepted conversation — fine at
  // MVP thread counts; fold into a single lateral query when it isn't.
  const staleByBrand = new Map<string, string[]>();
  for (const conv of conversations ?? []) {
    const { data: last } = await service
      .from("messages")
      .select("sender_id, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) continue;
    if (last.sender_id !== conv.creator_id) continue;
    if (new Date(last.created_at).getTime() > cutoff) continue;

    const { data: alreadyNagged } = await service
      .from("notifications")
      .select("id")
      .eq("user_id", conv.brand_id)
      .eq("kind", "stale_thread")
      .eq("href", `/inbox/${conv.id}`)
      .gte("created_at", renotifyCutoff)
      .limit(1)
      .maybeSingle();
    if (alreadyNagged) continue;

    const list = staleByBrand.get(conv.brand_id) ?? [];
    list.push(conv.id);
    staleByBrand.set(conv.brand_id, list);
  }

  let notified = 0;
  for (const [brandId, threadIds] of staleByBrand) {
    for (const id of threadIds) {
      await notify({
        userId: brandId,
        kind: "stale_thread",
        title: "A creator is waiting on your reply",
        href: `/inbox/${id}`,
      });
    }
    await notify({
      userId: brandId,
      kind: "agent_digest",
      title: `${threadIds.length} conversation${threadIds.length === 1 ? "" : "s"} waiting on your reply`,
      body: "Open your inbox to respond — you can ask for an AI draft in your voice on each thread.",
      href: "/inbox",
      email: true,
    });
    notified++;
  }

  return NextResponse.json({
    checked: (conversations ?? []).length,
    brandsNotified: notified,
  });
}
