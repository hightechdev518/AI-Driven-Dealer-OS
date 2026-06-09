"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AddVehicleDialog } from "@/components/add-vehicle-dialog";
import { CsvImportButton } from "@/components/csv-import-button";
import { FbListingBadge } from "@/components/fb-listing-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Vehicle } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency } from "@/lib/utils";

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(() => {
    setLoading(true);
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Inventory</h1>
          <p className="mt-1 text-slate-400">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} in stock
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvImportButton onImported={loadVehicles} />
          <AddVehicleDialog onAdded={loadVehicles} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">Loading inventory...</p>
          ) : vehicles.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              No vehicles yet. Add one or import from CSV.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year / Make / Model</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Retail</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Days in Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Facebook</TableHead>
                  <TableHead>AI Priority</TableHead>
                  <TableHead>Action Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/inventory/${vehicle.id}`}
                        className="font-medium text-orange-500 hover:underline"
                      >
                        {getVehicleLabel(vehicle)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {vehicle.mileage
                        ? `${vehicle.mileage.toLocaleString()} mi`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(vehicle.total_invested)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(vehicle.retail_price)}
                    </TableCell>
                    <TableCell>{formatCurrency(vehicle.net_profit)}</TableCell>
                    <TableCell>{vehicle.days_in_stock ?? 0}</TableCell>
                    <TableCell>{vehicle.status ?? "—"}</TableCell>
                    <TableCell>
                      {vehicle.fb_listing_url ? (
                        <div className="flex flex-col gap-1">
                          <FbListingBadge status={vehicle.fb_listing_status} />
                          <a
                            href={vehicle.fb_listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Listed on FB
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/inventory/${vehicle.id}`}>
                            Not Listed
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={vehicle.ai_priority} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-300">
                      {vehicle.action_required}
                    </TableCell>
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
