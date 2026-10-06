"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#141B47] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-6">
        <div className="flex justify-center">
          <BrandLogo variant="light" height={44} />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#F2901F]/20 text-[#F2901F] border border-[#F2901F]/30">
            404 — PAGE NOT FOUND
          </span>
          <h1 className="text-2xl font-bold text-white">Looking for something?</h1>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            The page or cargo tracking link you are trying to reach does not exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/" className="flex-1">
            <button className="w-full h-11 bg-[#F2901F] hover:bg-[#F2901F]/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer">
              <Home size={15} /> Back to Homepage
            </button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-4 h-11 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
