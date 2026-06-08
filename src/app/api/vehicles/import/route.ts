import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import type { VehicleFormData } from "@/lib/types";

const CSV_COLUMNS: (keyof VehicleFormData)[] = [
  "year",
  "make",
  "model",
  "mileage",
  "vin",
  "my_cost",
  "repair_cost",
  "retail_price",
  "listed_online",
  "online_channel",
  "status",
  "bought_date",
  "days_in_stock",
  "notes",
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseValue(key: keyof VehicleFormData, value: string): unknown {
  if (!value) return null;

  switch (key) {
    case "year":
    case "mileage":
    case "days_in_stock":
      return parseInt(value, 10) || null;
    case "my_cost":
    case "repair_cost":
    case "retail_price":
      return parseFloat(value.replace(/[$,]/g, "")) || null;
    case "listed_online":
      return ["true", "yes", "1", "y"].includes(value.toLowerCase());
    default:
      return value;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = parseCsvLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/\s+/g, "_")
    );

    const vehicles: ReturnType<typeof enrichVehicle>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: VehicleFormData = {};

      headers.forEach((header, index) => {
        const col = CSV_COLUMNS.find(
          (c) => c === header || c.replace(/_/g, "") === header.replace(/_/g, "")
        );
        if (col && values[index] !== undefined) {
          (row as Record<string, unknown>)[col] = parseValue(col, values[index]);
        }
      });

      if (row.make || row.model) {
        vehicles.push(enrichVehicle(row));
      }
    }

    if (vehicles.length === 0) {
      return NextResponse.json(
        { error: "No valid vehicles found in CSV" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .insert(vehicles)
      .select();

    if (error) throw error;

    return NextResponse.json({
      imported: data?.length ?? 0,
      vehicles: (data ?? []).map(enrichVehicleRecord),
    });
  } catch (error) {
    console.error("POST /api/vehicles/import:", error);
    return NextResponse.json(
      { error: "Failed to import vehicles" },
      { status: 500 }
    );
  }
}
