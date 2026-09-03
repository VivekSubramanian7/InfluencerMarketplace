"use client";

import { useEffect, useRef } from "react";
import { captureClientEvent } from "@/lib/analytics-client";

export function StorefrontTracker({
  creatorHandle,
  offeringsCount,
  reviewCount,
  viewerRole,
}: {
  creatorHandle: string;
  offeringsCount: number;
  reviewCount: number;
  viewerRole: string | null;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    captureClientEvent("storefront_viewed", {
      creator_handle: creatorHandle,
      offerings_count: offeringsCount,
      review_count: reviewCount,
      viewer_role: viewerRole,
    });
  }, [creatorHandle, offeringsCount, reviewCount, viewerRole]);

  return null;
}

export function SectionTracker({
  section,
  creatorHandle,
  children,
}: {
  section: string;
  creatorHandle: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          captureClientEvent("storefront_section_viewed", {
            creator_handle: creatorHandle,
            section,
          });
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [section, creatorHandle]);

  return <div ref={ref}>{children}</div>;
}
