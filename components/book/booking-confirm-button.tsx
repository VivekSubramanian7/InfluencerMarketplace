"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BookingConfirmButton({
  offeringTitle,
  price,
  creatorHandle,
}: {
  offeringTitle: string;
  price: string;
  creatorHandle: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" className="mt-2" onClick={() => setConfirming(true)}>
        Send booking request · ${price}
      </Button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-amber bg-amber/10 p-4">
      <p className="text-sm font-bold">Confirm your booking</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">{offeringTitle}</span>
          {creatorHandle ? ` by @${creatorHandle}` : ""}
        </li>
        <li>
          Price: <span className="font-bold text-foreground">${price}</span>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        This sends a booking request to the creator. Payment is handled outside the platform.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="submit">Confirm booking</Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Go back
        </Button>
      </div>
    </div>
  );
}
