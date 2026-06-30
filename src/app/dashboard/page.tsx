"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { InventoryFilterTabs } from "@/components/inventory/inventory-filter-tabs";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  countByFilter,
  matchesFilter,
  type FilterTab,
} from "@/lib/inventory-filters";
import type { AiPriority, Vehicle } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

const PRIORITY_ORDER: AiPriority[] = [
  "URGENT",
  "LIST NOW",
  "AUCTION",
  "PASS",
  "PRICE DROP",
  "MONEY TRAP",
  "BUY",
  "HOLD",
];

const PRIORITY_LABELS: Record<AiPriority, string> = {
  "LIST NOW": "🔥 LIST NOW",
  HOLD: "🟢 HOLD",
  "PRICE DROP": "🟡 PRICE DROP",
  AUCTION: "⚫ AUCTION",
  "MONEY TRAP": "💸 MONEY TRAP",
  URGENT: "🚨 URGENT",
  BUY: "✅ BUY",
  PASS: "⛔ PASS",
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("action");

  useEffect(() => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/messenger/unread")
      .then((r) => r.json())
      .then((data) => setUnreadMessages(data.unread_count ?? 0))
      .catch(() => setUnreadMessages(0));
  }, []);

  const totalVehicles = vehicles.length;
  const totalInvested = vehicles.reduce(
    (sum, v) => sum + (v.total_invested ?? 0),
    0
  );
  const retailValue = vehicles.reduce(
    (sum, v) => sum + (v.retail_price ?? 0),
    0
  );
  const expectedProfit = vehicles.reduce(
    (sum, v) => sum + (v.net_profit ?? 0),
    0
  );
  const avgRoi =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + (v.roi ?? 0), 0) / vehicles.length
      : 0;

  const priorityCounts = PRIORITY_ORDER.reduce(
    (acc, p) => {
      acc[p] = vehicles.filter((v) => v.ai_priority === p).length;
      return acc;
    },
    {} as Record<AiPriority, number>
  );

  const filterCounts = useMemo(() => countByFilter(vehicles), [vehicles]);

  const filteredVehicles = useMemo(
    () =>
      vehicles
        .filter((v) => matchesFilter(v, activeFilter))
        .sort((a, b) => {
          const aIdx = PRIORITY_ORDER.indexOf(a.ai_priority as AiPriority);
          const bIdx = PRIORITY_ORDER.indexOf(b.ai_priority as AiPriority);
          return aIdx - bIdx;
        }),
    [vehicles, activeFilter]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-slate-400">23 Motorsports — Daily Overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Total Vehicles" value={String(totalVehicles)} />
        <KpiCard title="Total Invested" value={formatCurrency(totalInvested)} />
        <KpiCard title="Retail Value" value={formatCurrency(retailValue)} />
        <KpiCard
          title="Expected Profit"
          value={formatCurrency(expectedProfit)}
        />
        <KpiCard title="Average ROI" value={formatPercent(avgRoi)} />
      </div>

      <Link href="/messenger">
        <Card className="border-orange-500/30 bg-orange-500/5 transition-colors hover:bg-orange-500/10">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="font-semibold text-white">Messenger Inbox</p>
                <p className="text-sm text-slate-400">
                  {unreadMessages > 0
                    ? `${unreadMessages} unread message${unreadMessages !== 1 ? "s" : ""}`
                    : "All caught up"}
                </p>
              </div>
            </div>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">
                {unreadMessages}
              </span>
            )}
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {PRIORITY_ORDER.map((priority) => (
          <Card key={priority}>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">
                {PRIORITY_LABELS[priority]}
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {priorityCounts[priority]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Daily Action Board
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {filterCounts.action} vehicle{filterCounts.action !== 1 ? "s" : ""}{" "}
            need attention today
          </p>
        </div>

        <InventoryFilterTabs
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={filterCounts}
        />

        {filteredVehicles.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center">
            <p className="font-medium text-white">No vehicles match this filter</p>
            <p className="mt-1 text-sm text-slate-400">
              {activeFilter === "action"
                ? "All vehicles are on hold — nothing needs action right now."
                : "Try a different filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <InventoryCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
