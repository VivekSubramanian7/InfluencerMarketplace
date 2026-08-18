import { createServerSupabase } from "@/lib/supabase/server";
import { sendMessage } from "./message-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function DealMessages({ dealId, userId }: { dealId: string; userId: string }) {
  const supabase = await createServerSupabase();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("deal_id", dealId)
    .order("created_at");

  return (
    <section className="mt-6 rounded-xl border p-5">
      <h2 className="text-base font-bold">Messages</h2>
      <ul className="mt-3 mb-4 flex flex-col gap-2">
        {(messages ?? []).map((m) => (
          <li key={m.id}
            className={`max-w-[85%] rounded-lg p-3 text-sm ${
              m.sender_id === userId ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary"
            }`}>
            <p className="whitespace-pre-line break-words">{m.body}</p>
            <p className={`mt-1 text-xs ${m.sender_id === userId ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {new Date(m.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(messages ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">No messages yet — say hello.</li>
        )}
      </ul>
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="deal_id" value={dealId} />
        <Input
          name="body"
          placeholder="Write a message"
          aria-label="Write a message"
          required
          maxLength={5000}
          className="flex-1"
        />
        <Button type="submit">Send</Button>
      </form>
    </section>
  );
}
