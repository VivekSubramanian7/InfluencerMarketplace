"use client";

import { useState } from "react";
import { BookCallBlocker } from "@/components/discover/book-call-blocker";

export function InviteCapBlocker() {
  const [open, setOpen] = useState(true);
  return <BookCallBlocker open={open} onClose={() => setOpen(false)} />;
}
