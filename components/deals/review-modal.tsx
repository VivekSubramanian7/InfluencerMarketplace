"use client";

import { useRef } from "react";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewModal({
  dealId,
  action,
}: {
  dealId: string;
  action: (formData: FormData) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Leave a review
      </Button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg backdrop:bg-black/50"
      >
        <h2 className="text-base font-bold">Leave a review</h2>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="deal_id" value={dealId} />
          <div>
            <StarRating name="rating" defaultValue={5} />
          </div>
          <Textarea name="body" rows={3} placeholder="How was the collaboration?" />
          <div className="mt-2 flex gap-2">
            <Button type="submit" className="px-6">Submit review</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
