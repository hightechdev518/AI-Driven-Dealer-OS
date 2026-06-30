"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { AddVehicleDialog } from "@/components/add-vehicle-dialog";
import { CsvImportButton } from "@/components/csv-import-button";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { InventoryFilterTabs } from "@/components/inventory/inventory-filter-tabs";
import { Button } from "@/components/ui/button";
import {
  countByFilter,
  matchesFilter,
  type FilterTab,
} from "@/lib/inventory-filters";
import type { Vehicle } from "@/lib/types";

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

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

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => matchesFilter(v, activeFilter)),
    [vehicles, activeFilter]
  );

  const filterCounts = useMemo(() => countByFilter(vehicles), [vehicles]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Inventory Brain
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} in stock
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvImportButton onImported={loadVehicles} />
          <AddVehicleDialog onAdded={loadVehicles} />
        </div>
      </div>

      <InventoryFilterTabs
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={filterCounts}
      />

      {loading ? (
        <div className="flex h-52 items-center justify-center rounded-2xl border border-white/[0.08] bg-[hsl(222,47%,9%)]">
          <p className="text-slate-400">Loading inventory...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center">
          <p className="font-medium text-white">
            {vehicles.length === 0 ? "No vehicles yet" : "No vehicles match this filter"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {vehicles.length === 0
              ? "Add a vehicle with a photo to get started."
              : "Try a different filter."}
          </p>
          {vehicles.length === 0 && (
            <div className="mt-4">
              <AddVehicleDialog
                onAdded={loadVehicles}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <InventoryCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
