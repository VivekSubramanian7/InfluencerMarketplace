"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: { maskAllInputs: true },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export function PostHogProvider({
  children,
  userId,
  userRole,
}: {
  children: React.ReactNode;
  userId?: string | null;
  userRole?: string | null;
}) {
  return (
    <PHProvider client={posthog}>
      {userId && <PostHogIdentify userId={userId} userRole={userRole} />}
      {children}
    </PHProvider>
  );
}

function PostHogIdentify({
  userId,
  userRole,
}: {
  userId: string;
  userRole?: string | null;
}) {
  const ph = usePostHog();
  useEffect(() => {
    if (userId) {
      ph.identify(userId, { role: userRole ?? undefined });
    }
    return () => {
      // Reset on logout (userId becomes null → component unmounts)
      ph.reset();
    };
  }, [ph, userId, userRole]);
  return null;
}
