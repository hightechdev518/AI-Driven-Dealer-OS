"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationSummary, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessengerContent() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selected = conversations.find((c) => c.customer.id === selectedId);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/messenger/conversations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load conversations");
        return;
      }
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (customerId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        await fetch("/api/messenger/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: customerId }),
        });
        loadConversations();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/messenger/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }
      await loadConversations();
    } catch (err) {
      console.error(err);
      setError("Network error during sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setToast(null);
    try {
      const res = await fetch("/api/messenger/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: selectedId, message: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Failed to send message");
        return;
      }
      setReply("");
      await loadMessages(selectedId);
    } catch (err) {
      console.error(err);
      setToast("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: selected.customer.id }),
      });
      if (res.ok) {
        setToast("Customer saved to database");
        loadConversations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Messenger</h1>
          <p className="mt-1 text-slate-400">
            Facebook Page inbox — customer conversations
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sync from Facebook
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {toast && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-center text-slate-400">Loading...</p>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-3 text-slate-400">No conversations yet.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Click &quot;Sync from Facebook&quot; to pull your Page inbox.
                </p>
              </div>
            ) : (
              <ul className="max-h-[600px] divide-y divide-slate-800 overflow-y-auto">
                {conversations.map((conv) => (
                  <li key={conv.customer.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(conv.customer.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors hover:bg-slate-800/50",
                        selectedId === conv.customer.id && "bg-orange-500/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-white">
                          {conv.customer.name ?? "Unknown"}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-400">
                        {conv.last_message ?? "No messages"}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{formatDate(conv.last_message_at)}</span>
                        {conv.customer.phone && (
                          <span>{conv.customer.phone}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selected
                ? selected.customer.name ?? "Conversation"
                : "Select a conversation"}
            </CardTitle>
            {selected && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleAddCustomer}>
                  <UserPlus className="h-3 w-3" />
                  Add to Customers
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/customers/${selected.customer.id}`}>
                    View Profile
                  </Link>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <div className="flex h-80 items-center justify-center text-slate-500">
                Select a conversation to view messages
              </div>
            ) : loadingMessages ? (
              <div className="flex h-80 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : (
              <>
                <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-slate-500">No messages</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === "outbound"
                            ? "justify-end"
                            : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                            msg.direction === "outbound"
                              ? "bg-orange-500 text-white"
                              : "bg-slate-800 text-slate-100"
                          )}
                        >
                          <p>{msg.message}</p>
                          <p className="mt-1 text-xs opacity-70">
                            {formatDate(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !reply.trim()}
                    className="self-end"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
