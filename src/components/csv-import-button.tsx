"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvImportButtonProps {
  onImported: () => void;
}

export function CsvImportButton({ onImported }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/vehicles/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await res.json();
      alert(`Successfully imported ${result.imported} vehicle(s)`);
      onImported();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        <Upload className="h-4 w-4" />
        {loading ? "Importing..." : "Import CSV"}
      </Button>
    </>
  );
}
