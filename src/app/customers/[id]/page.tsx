"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, CustomerInquiry, Message } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InquiryWithVehicle extends CustomerInquiry {
  vehicles: {
    id: string;
    year: number | null;
    make: string | null;
    model: string | null;
    retail_price: number | null;
    status: string | null;
  } | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inquiries, setInquiries] = useState<InquiryWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomer(data.customer);
      setMessages(data.messages ?? []);
      setInquiries(data.inquiries ?? []);
      setNotes(data.customer.notes ?? "");
    } catch (err) {
      console.error(err);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCustomer(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-slate-400">Customer not found.</p>
        <Button variant="outline" asChild>
          <Link href="/messenger">Back to Messenger</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/messenger" className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {customer.name ?? "Customer"}
          </h1>
          <p className="mt-1 text-slate-400">
            Source: {customer.source ?? "unknown"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ProfileRow label="Phone" value={customer.phone} />
            <ProfileRow label="Email" value={customer.email} />
            <ProfileRow
              label="Facebook"
              value={
                customer.fb_profile_url ? (
                  <a
                    href={customer.fb_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                  >
                    Profile <ExternalLink className="h-3 w-3" />
                  </a>
                ) : customer.fb_messenger_id ? (
                  <a
                    href={`https://www.messenger.com/t/${customer.fb_messenger_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                  >
                    Messenger <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
            <div className="space-y-2 pt-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Inquiries</CardTitle>
          </CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <p className="text-sm text-slate-400">
                No linked vehicle inquiries yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {inquiries.map((inq) => (
                  <li
                    key={inq.id}
                    className="rounded-lg border border-slate-800 p-3"
                  >
                    {inq.vehicles ? (
                      <Link
                        href={`/inventory/${inq.vehicles.id}`}
                        className="font-medium text-orange-500 hover:underline"
                      >
                        {getVehicleLabel(inq.vehicles)}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Unknown vehicle</span>
                    )}
                    {inq.vehicles?.retail_price != null && (
                      <p className="text-sm text-slate-400">
                        {formatCurrency(inq.vehicles.retail_price)} ·{" "}
                        {inq.vehicles.status}
                      </p>
                    )}
                    {inq.notes && (
                      <p className="mt-1 text-sm text-slate-500">{inq.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-slate-400">No messages</p>
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
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-200">{value ?? "—"}</span>
    </div>
  );
}
