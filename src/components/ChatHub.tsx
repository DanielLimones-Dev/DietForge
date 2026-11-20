"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MessageSquare, RefreshCw, Search, Send, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { readPortal, writeActivity } from "@/lib/client-portal";
import type { Activity } from "@/lib/training-tracking";
import type { Client } from "@/types";

interface ChatMessage {
  id: string;
  sender: "coach" | "client";
  text: string;
  created_at: string;
}

export function ChatHub() {
  const [clients] = useState<Client[]>(() => db.getClients());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number>(() => db.getClients()[0]?.id ?? 0);
  const [ownerId, setOwnerId] = useState<string>("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, search]);

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  const fetchConversation = useCallback(async (clientId: number, currentOwner: string) => {
    let uid = currentOwner;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? "";
      if (uid) setOwnerId(uid);
    }
    if (!uid) {
      return { activity: [] as Activity[], error: "Inicia sesión para cargar los mensajes." };
    }
    const portal = await readPortal(uid, clientId);
    return { activity: portal.activity ?? [], error: "" };
  }, []);

  const loadMessages = useCallback(
    async (clientId: number) => {
      if (!clientId) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetchConversation(clientId, ownerId);
        setActivity(res.activity);
        setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar los mensajes.");
        setActivity([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchConversation, ownerId]
  );

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetchConversation(selectedId, ownerId);
        if (!active) return;
        setActivity(res.activity);
        setError(res.error);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "No se pudieron cargar los mensajes.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    const channel = supabase
      .channel(`chat-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dietforge_client_activity",
          filter: `client_id=eq.${selectedId}`,
        },
        () => {
          void poll();
        }
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [selectedId, ownerId, fetchConversation]);

  const messages: ChatMessage[] = useMemo(() => {
    return activity
      .filter(
        (a) =>
          (a.kind === "chat_message" ||
            (a.kind === "event" && a.data?.event_type === "chat_message")) &&
          typeof a.data?.text === "string"
      )
      .map((a) => ({
        id: a.id,
        sender: a.data.sender === "coach" ? ("coach" as const) : ("client" as const),
        text: String(a.data.text),
        created_at: typeof a.data.created_at === "string" ? a.data.created_at : "",
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [activity]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      let uid = ownerId;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id ?? "";
        if (uid) setOwnerId(uid);
      }
      if (!uid) throw new Error("Inicia sesión para enviar mensajes.");
      const nowIso = new Date().toISOString();
      await writeActivity(uid, selectedId, {
        id: crypto.randomUUID(),
        kind: "event",
        data: {
          date: nowIso.slice(0, 10),
          completed: true,
          title: clean.slice(0, 300),
          event_type: "chat_message",
          sender: "coach",
          text: clean,
          created_at: nowIso,
        },
      });
      setText("");
      await loadMessages(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-hub-page">
      <div className="chat-hub-shell">
        <aside className="chat-hub-sidebar" aria-label="Lista de conversaciones">
          <div className="chat-hub-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              aria-label="Buscar cliente en chat"
            />
          </div>

          <div className="chat-hub-list" role="list">
            {filteredClients.length === 0 ? (
              <p className="chat-hub-empty-list">Sin clientes.</p>
            ) : (
              filteredClients.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={`chat-hub-contact ${active ? "is-active" : ""}`}
                  >
                    <span className="chat-hub-avatar" aria-hidden="true">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="chat-hub-contact-meta">
                      <strong>{c.name}</strong>
                      <small>{c.email || "Sin correo registrado"}</small>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="chat-hub-thread" aria-label="Conversación activa">
          {!selectedClient ? (
            <div className="chat-hub-empty-thread">
              <MessageSquare size={32} aria-hidden="true" />
              <p>Selecciona un cliente para comenzar a chatear.</p>
            </div>
          ) : (
            <>
              <header className="chat-hub-thread-head">
                <div className="chat-hub-thread-user">
                  <span className="chat-hub-avatar is-header" aria-hidden="true">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h2>{selectedClient.name}</h2>
                    <p>{selectedClient.email || "Portal del cliente"}</p>
                  </div>
                </div>
                <div className="chat-hub-thread-actions">
                  <button
                    type="button"
                    onClick={() => void loadMessages(selectedClient.id)}
                    disabled={loading}
                    className="df-button-secondary"
                    aria-label="Actualizar mensajes"
                  >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />
                    Actualizar
                  </button>
                  <Link href={`/clients/${selectedClient.id}`} className="df-button-secondary">
                    <ExternalLink size={13} aria-hidden="true" />
                    Expediente
                  </Link>
                </div>
              </header>

              <div role="log" aria-live="polite" className="chat-hub-messages">
                {loading && messages.length === 0 ? (
                  <p className="chat-hub-status">Cargando mensajes…</p>
                ) : messages.length === 0 ? (
                  <div className="chat-hub-empty-thread">
                    <MessageSquare size={26} aria-hidden="true" />
                    <p>Aún no hay mensajes con {selectedClient.name}. Escribe el primero abajo.</p>
                  </div>
                ) : (
                  (() => {
                    const toDayKey = (d: Date) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const now = new Date();
                    const todayKey = toDayKey(now);
                    return messages.map((msg, idx) => {
                      const isCoach = msg.sender === "coach";
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
                        <div key={msg.id} className="chat-hub-entry">
                          {showPastDate && (
                            <div className="chat-day-divider">
                              <span>{dayLabel}</span>
                            </div>
                          )}
                          <div className={`chat-hub-row ${isCoach ? "is-coach" : "is-client"}`}>
                            <div className={`chat-hub-bubble ${isCoach ? "is-coach" : "is-client"}`}>
                              <p>{msg.text}</p>
                              {timeLabel && <time>{timeLabel}</time>}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={bottomRef} />
              </div>

              {error && (
                <p role="alert" className="chat-hub-error">
                  {error}
                </p>
              )}

              <form onSubmit={(e) => void handleSend(e)} className="chat-hub-composer">
                <label htmlFor="chathub-input" className="sr-only">
                  Escribe un mensaje para {selectedClient.name}
                </label>
                <input
                  id="chathub-input"
                  type="text"
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Escribe un mensaje para ${selectedClient.name}…`}
                />
                <button type="submit" disabled={sending || !text.trim()} className="df-button">
                  <Send size={15} aria-hidden="true" />
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
