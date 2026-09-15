"use client";

import dynamic from "next/dynamic";

/**
 * The shoe is shuffled and saved progress is read in the browser, so these views
 * skip server rendering entirely rather than risk a hydration mismatch.
 */
function Loading() {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 place-items-center px-4 py-24">
      <div className="flex items-center gap-3 text-brass-300/70">
        <span className="size-2 animate-ping rounded-full bg-brass-400" />
        Shuffling the shoe…
      </div>
    </div>
  );
}

export const BlackjackTableClient = dynamic(() => import("@/components/table/BlackjackTable"), {
  ssr: false,
  loading: Loading,
});

export const DrillsClient = dynamic(() => import("@/components/drills/Drills"), {
  ssr: false,
  loading: Loading,
});
