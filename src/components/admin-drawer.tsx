"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";

export interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
  isDirty?: boolean;
}

export function AdminDrawer({
  isOpen,
  onClose,
  title,
  description,
  icon,
  badge,
  children,
  footer,
  widthClassName = "sm:max-w-lg md:max-w-xl",
  isDirty = false,
}: AdminDrawerProps) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleAttemptClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, showDiscardConfirm, handleAttemptClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        onClick={handleAttemptClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`relative z-10 w-full ${widthClassName} bg-white shadow-2xl flex flex-col h-full overflow-hidden transition-transform duration-300 ease-out animate-in slide-in-from-right`}
      >
        {/* Sticky Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F7F9FC] shrink-0 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-[#141B47] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="drawer-title"
                  className="text-lg md:text-xl font-bold text-[#141B47] leading-tight truncate"
                >
                  {title}
                </h2>
                {badge}
              </div>
              {description && (
                <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-2 rounded-xl text-[#667085] hover:text-[#141B47] hover:bg-gray-200/60 transition-colors shrink-0 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#F2901F]"
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-7 space-y-6 bg-white text-[#172236] overscroll-contain">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F7F9FC] shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}

        {/* Unsaved Changes Confirmation Dialog */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E5E7EB] space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <AlertTriangle size={24} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-base text-[#141B47]">
                  Discard unsaved changes?
                </h3>
                <p className="text-xs text-[#667085] leading-relaxed">
                  You have made modifications to this form. If you close now, your changes will be discarded.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-xs"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
