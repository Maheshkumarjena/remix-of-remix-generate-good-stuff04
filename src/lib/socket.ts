import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "./api";

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;
let currentKey = "";

function connect(userId: string, sessionId?: string): Socket {
  const key = `${userId}:${sessionId ?? ""}`;
  if (socket && currentKey === key) return socket;
  socket?.disconnect();
  currentKey = key;
  socket = io(`${API_BASE_URL}/ws`, {
    transports: ["websocket"],
    withCredentials: true,
    query: sessionId ? { user_id: userId, session_id: sessionId } : { user_id: userId },
  });
  return socket;
}

/**
 * Subscribes to the backend `event` channel and dispatches by `event.type`.
 * Silently no-ops when the user is not signed in.
 */
export function useRealtime(
  userId: string | undefined,
  handler: (event: RealtimeEvent) => void,
  sessionId?: string,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (isDemoMode()) return; // no realtime channel in demo mode
    const s = connect(userId, sessionId);

    const listener = (event: RealtimeEvent) => handlerRef.current(event);
    s.on("event", listener);
    return () => {
      s.off("event", listener);
    };
  }, [userId, sessionId]);
}
