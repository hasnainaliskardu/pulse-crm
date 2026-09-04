"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { initSync, trySync, setLocalUser, subscribeRealtime, type ConnState } from "@/lib/local/sync";
import { db } from "@/lib/local/db";

interface SyncCtx {
  state: ConnState;
  pending: number;
  sync: () => void;
}

const SyncContext = createContext<SyncCtx>({ state: "online", pending: 0, sync: () => {} });

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ConnState>("online");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    void setLocalUser(userId);
    const cleanup = initSync({
      onStateChange: (s, p) => {
        setState(s);
        setPending(p);
      },
      onMirrorUpdate: () => {},
    });

    let unsub: (() => void) | null = null;
    let cancelled = false;
    // realtime only when online; re-attach on reconnect
    const attach = () => {
      if (unsub || cancelled) return;
      if (navigator.onLine) {
        unsub = subscribeRealtime(userId);
      }
    };
    attach();
    const onOnline = () => {
      attach();
      void trySync("back-online");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", () => {
      unsub?.();
      unsub = null;
    });

    // draft restore toast
    if (typeof window !== "undefined" && !window.__hanaDraftToastShown) {
      void db.drafts.count().then((n) => {
        if (n > 0) {
          toast.info(`Draft restored — ${n} unsent form${n > 1 ? "s" : ""} recovered`);
          window.__hanaDraftToastShown = true;
        }
      });
    }

    return () => {
      cancelled = true;
      cleanup?.();
      window.removeEventListener("online", onOnline);
    };
  }, [userId]);

  const sync = useCallback(() => void trySync("manual"), []);

  return (
    <SyncContext.Provider value={{ state, pending, sync }}>
      {children}
    </SyncContext.Provider>
  );
}

declare global {
  interface Window {
    __hanaDraftToastShown?: boolean;
  }
}
