"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VehicleForm } from "@/components/vehicle-form";
import type { VehicleFormData } from "@/lib/types";

interface AddVehicleDialogProps {
  onAdded: () => void;
  trigger?: ReactNode;
}

export function AddVehicleDialog({ onAdded, trigger }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (data: VehicleFormData) => {
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to add vehicle");
    }

    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>
        <VehicleForm onSubmit={handleSubmit} submitLabel="Add to Inventory" />
      </DialogContent>
    </Dialog>
  );
}
