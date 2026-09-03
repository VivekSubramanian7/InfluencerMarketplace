"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AutoScroll() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");

  useEffect(() => {
    if (focus === "offer") {
      document.getElementById("offer-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus]);

  return null;
}
