"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message={error instanceof Error && error.message ? error.message : "The data could not be loaded."}
      action={
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white"
        >
          Retry
        </button>
      }
    />
  );
}
