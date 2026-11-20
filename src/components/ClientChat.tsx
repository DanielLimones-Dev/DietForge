"use client";

import { useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { Activity } from "@/lib/training-tracking";

interface ChatMessage {
  id: string;
  sender: "coach" | "client";
  text: string;
  created_at: string;
}

interface Props {
  activity: Activity[];
  coach?: boolean;
  clientName: string;
  onSave: (activity: Activity) => Promise<void>;
  onSaved: () => void;
}

export function ClientChat({ activity, coach = false, clientName, onSave, onSaved }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const messages: ChatMessage[] = activity
    .filter((a) => (a.kind === "chat_message" || (a.kind === "event" && a.data?.event_type === "chat_message")) && typeof a.data?.text === "string")
    .map((a) => ({
      id: a.id,
      sender: a.data.sender === "coach" ? ("coach" as const) : ("client" as const),
      text: String(a.data.text),
      created_at: typeof a.data.created_at === "string" ? a.data.created_at : "",
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      await onSave({
        id: crypto.randomUUID(),
        kind: "event",
        data: {
          date: nowIso.slice(0, 10),
          completed: true,
          title: clean.slice(0, 300),
          event_type: "chat_message",
          sender: coach ? "coach" : "client",
          text: clean,
          created_at: nowIso,
        },
      });
      setText("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="care-card portal-section" aria-labelledby="client-chat-title">
      <header className="portal-section-head">
        <div>
          <span className="portal-kicker">COMUNICACIÓN DIRECTA</span>
          <h2 id="client-chat-title">Chat con {coach ? clientName : "tu coach"}</h2>
          <p>Mensajes directos dentro de la app, sincronizados con tu expediente.</p>
        </div>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label="Historial de mensajes"
        className="mt-4 max-h-96 overflow-y-auto space-y-2.5 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 flex flex-col items-center gap-2">
            <MessageSquare size={22} className="text-gray-400" aria-hidden="true" />
            <p>Aún no hay mensajes. Envía el primero aquí abajo.</p>
          </div>
        ) : (
          (() => {
            const toDayKey = (d: Date) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const now = new Date();
            const todayKey = toDayKey(now);
            return messages.map((msg, idx) => {
              const mine = coach ? msg.sender === "coach" : msg.sender === "client";
              const dateObj = msg.created_at ? new Date(msg.created_at) : null;
              const dayKey = dateObj ? toDayKey(dateObj) : "";
              const prevDate = idx > 0 && messages[idx - 1].created_at ? new Date(messages[idx - 1].created_at) : null;
              const prevDayKey = prevDate ? toDayKey(prevDate) : "";
              const showPastDate = Boolean(dateObj && dayKey !== todayKey && dayKey !== prevDayKey);
              const dayLabel = dateObj
                ? dateObj.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    ...(dateObj.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
                  })
                : "";
              const timeLabel = dateObj
                ? dateObj.toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div key={msg.id} className="client-chat-entry">
                  {showPastDate && (
                    <div className="chat-day-divider">
                      <span>{dayLabel}</span>
                    </div>
                  )}
                  <div className={`client-chat-row ${mine ? "is-mine" : "is-theirs"}`}>
                    <div className={`client-chat-bubble ${mine ? "is-mine" : "is-theirs"}`}>
                      <p>{msg.text}</p>
                      {timeLabel && <time>{timeLabel}</time>}
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {error && <p role="alert" className="care-notice mt-3">{error}</p>}

      <form onSubmit={(e) => void send(e)} className="mt-3 flex gap-2 items-end">
        <label htmlFor="chat-message-input" className="sr-only">
          Escribe un mensaje
        </label>
        <input
          id="chat-message-input"
          type="text"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="portal-button portal-button-primary"
        >
          <Send size={15} aria-hidden="true" />
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </section>
  );
}
