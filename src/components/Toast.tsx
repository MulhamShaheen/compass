"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/run";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => {
    setMessage(m);
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2600);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast${on ? " on" : ""}`} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Runs a server action in a transition, toasts its message, and keeps the last error for inline display. */
export function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const go = useCallback(
    (fn: () => Promise<ActionResult>, onOk?: (r: Extract<ActionResult, { ok: true }>) => void) => {
      setError(null);
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (r.message) toast(r.message);
          onOk?.(r);
        } else {
          setError(r.error);
          toast(r.error);
        }
      });
    },
    [toast],
  );
  return { pending, error, go };
}
