"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/kpi-card";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AiPriority, Vehicle } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency, formatPercent } from "@/lib/utils";

const PRIORITY_ORDER: AiPriority[] = [
  "LIST NOW",
  "PRICE DROP",
  "AUCTION",
  "HOLD",
];

const PRIORITY_LABELS: Record<AiPriority, string> = {
  "LIST NOW": "🔥 LIST NOW",
  HOLD: "🟢 HOLD",
  "PRICE DROP": "🟡 PRICE DROP",
  AUCTION: "⚫ AUCTION",
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const actionBoard = [...vehicles]
    .filter((v) => v.ai_priority !== "HOLD")
    .sort((a, b) => {
      const aIdx = PRIORITY_ORDER.indexOf(a.ai_priority as AiPriority);
      const bIdx = PRIORITY_ORDER.indexOf(b.ai_priority as AiPriority);
      return aIdx - bIdx;
    });

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Daily Action Board</CardTitle>
        </CardHeader>
        <CardContent>
          {actionBoard.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              No action items — all vehicles are on hold.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Recommended Price</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Days in Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionBoard.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <PriorityBadge priority={vehicle.ai_priority} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/inventory/${vehicle.id}`}
                        className="font-medium text-orange-500 hover:underline"
                      >
                        {getVehicleLabel(vehicle)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(vehicle.recommended_price)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-slate-300">
                      {vehicle.action_required}
                    </TableCell>
                    <TableCell>{formatCurrency(vehicle.net_profit)}</TableCell>
                    <TableCell>{vehicle.days_in_stock ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
