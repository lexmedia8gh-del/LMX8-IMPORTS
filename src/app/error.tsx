"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Route Error Boundary caught error]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-[#141B47] border border-slate-200 dark:border-[#355DAF]/30 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Unable to Load Page</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {error?.message || "An unexpected error occurred while loading this view."}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="w-full h-11 bg-[#141B47] hover:bg-[#355DAF] text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
