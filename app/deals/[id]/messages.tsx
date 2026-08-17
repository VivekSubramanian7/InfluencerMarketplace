import { createServerSupabase } from "@/lib/supabase/server";
import { sendMessage } from "./message-actions";

export async function DealMessages({ dealId, userId }: { dealId: string; userId: string }) {
  const supabase = await createServerSupabase();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("deal_id", dealId)
    .order("created_at");

  return (
    <section className="mb-6 border rounded p-4">
      <h2 className="font-medium mb-3">Messages</h2>
      <ul className="flex flex-col gap-2 mb-4">
        {(messages ?? []).map((m) => (
          <li key={m.id}
            className={`rounded p-3 text-sm max-w-[85%] ${
              m.sender_id === userId ? "bg-black text-white self-end" : "bg-gray-100 self-start"
            }`}>
            <p className="whitespace-pre-line break-words">{m.body}</p>
            <p className={`text-xs mt-1 ${m.sender_id === userId ? "text-gray-300" : "text-gray-500"}`}>
              {new Date(m.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(messages ?? []).length === 0 && (
          <li className="text-sm text-gray-500">No messages yet — say hello.</li>
        )}
      </ul>
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="deal_id" value={dealId} />
        <input name="body" placeholder="Write a message" required maxLength={5000}
          className="border rounded p-2 flex-1" />
        <button className="bg-black text-white rounded px-4">Send</button>
      </form>
    </section>
  );
}
