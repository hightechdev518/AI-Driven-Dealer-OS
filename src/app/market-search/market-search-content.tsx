"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, ExternalLink, Loader2, MessageCircle, RotateCcw, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FbListing } from "@/lib/fb-scraper/types";
import { formatCurrency } from "@/lib/utils";

const RADIUS_OPTIONS = [10, 25, 50, 100, 200];
const RESULT_OPTIONS = [10, 25, 50];

const defaultForm = {
  make: "",
  model: "",
  yearFrom: "",
  yearTo: "",
  mileageMax: "",
  priceMin: "",
  priceMax: "",
  location: "",
  radius: "25",
  resultLimit: "25",
};

export default function MarketSearchContent() {
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get("vehicle_id");

  const [form, setForm] = useState(defaultForm);
  const [results, setResults] = useState<FbListing[]>([]);
  const [resultBatch, setResultBatch] = useState(0);
  const [batchInput, setBatchInput] = useState("0");
  const [skipCount, setSkipCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

  const updateField = (field: keyof typeof defaultForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const runSearch = useCallback(
    async (batch: number) => {
      setLoading(true);
      setError(null);
      setResetMessage(null);
      setResults([]);
      setHasSearched(true);
      setResultBatch(batch);
      setBatchInput(String(batch));

      try {
        const res = await fetch("/api/fb-scraper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: form.make,
            model: form.model,
            yearFrom: form.yearFrom ? Number(form.yearFrom) : 0,
            yearTo: form.yearTo ? Number(form.yearTo) : 0,
            mileageMax: form.mileageMax ? Number(form.mileageMax) : 0,
            priceMin: form.priceMin ? Number(form.priceMin) : 0,
            priceMax: form.priceMax ? Number(form.priceMax) : 0,
            location: form.location,
            radius: Number(form.radius),
            resultLimit: Number(form.resultLimit),
            resultBatch: batch,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Search failed");
          setHasMore(false);
          setSkipCount(0);
          return;
        }

        setResults(Array.isArray(data.results) ? data.results : []);
        setSkipCount(typeof data.skipCount === "number" ? data.skipCount : batch * Number(form.resultLimit));
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        console.error(err);
        setError("Network error while scraping. Is Multilogin running locally?");
        setHasMore(false);
        setSkipCount(0);
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  const handleSearch = useCallback(async () => {
    setSavedUrls(new Set());
    await runSearch(0);
  }, [runSearch]);

  const handleNextResults = useCallback(async () => {
    await runSearch(resultBatch + 1);
  }, [resultBatch, runSearch]);

  const handleGoToBatch = useCallback(async () => {
    const batch = Math.max(0, Number.parseInt(batchInput, 10) || 0);
    setBatchInput(String(batch));
    await runSearch(batch);
  }, [batchInput, runSearch]);

  const canGoNext =
    hasSearched && hasMore && !loading && !resetting && (form.make || form.model);

  const paginationFooter = !loading &&
    hasSearched &&
    (results.length > 0 || resultBatch > 0) && (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
      <p className="text-sm text-slate-400">
        {hasMore
          ? "More listings may be available."
          : results.length > 0
            ? "End of available listings for this search."
            : resultBatch > 0
              ? "No more listings found for this search."
              : "No listings matched your filters."}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={handleNextResults}
        disabled={!canGoNext}
      >
        <ChevronRight className="h-4 w-4" />
        Next results
      </Button>
    </div>
  );

  const handleResetSession = useCallback(async () => {
    setResetting(true);
    setError(null);
    setResetMessage(null);

    try {
      const res = await fetch("/api/fb-scraper/reset-session", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset browser session");
        return;
      }

      setResetMessage(data.message || "Browser session reset.");
    } catch (err) {
      console.error(err);
      setError("Network error while resetting browser session.");
    } finally {
      setResetting(false);
    }
  }, []);

  const handleSave = async (listing: FbListing) => {
    setSavingId(listing.url);
    try {
      const res = await fetch("/api/fb-scraper/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId || undefined,
          results: [listing],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save comp");
        return;
      }

      setSavedUrls((prev) => new Set(prev).add(listing.url));
    } catch (err) {
      console.error(err);
      alert("Failed to save comp");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Market Search</h1>
        <p className="mt-1 text-slate-400">
          Search Facebook Marketplace for vehicle comps
          {vehicleId && (
            <span className="text-orange-500"> — linked to inventory vehicle</span>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Uses Multilogin on the server. Port 45000 is the launcher (always on).
          Reset stops the browser profile only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                placeholder="BMW"
                value={form.make}
                onChange={(e) => updateField("make", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="M3"
                value={form.model}
                onChange={(e) => updateField("model", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location / Zip Code</Label>
              <Input
                id="location"
                placeholder="90210 or Los Angeles, CA"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearFrom">Year From</Label>
              <Input
                id="yearFrom"
                type="number"
                placeholder="2018"
                value={form.yearFrom}
                onChange={(e) => updateField("yearFrom", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearTo">Year To</Label>
              <Input
                id="yearTo"
                type="number"
                placeholder="2023"
                value={form.yearTo}
                onChange={(e) => updateField("yearTo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileageMax">Mileage Max</Label>
              <Input
                id="mileageMax"
                type="number"
                placeholder="80000"
                value={form.mileageMax}
                onChange={(e) => updateField("mileageMax", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceMin">Price Min</Label>
              <Input
                id="priceMin"
                type="number"
                placeholder="20000"
                value={form.priceMin}
                onChange={(e) => updateField("priceMin", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceMax">Price Max</Label>
              <Input
                id="priceMax"
                type="number"
                placeholder="60000"
                value={form.priceMax}
                onChange={(e) => updateField("priceMax", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (miles)</Label>
              <select
                id="radius"
                value={form.radius}
                onChange={(e) => updateField("radius", e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={String(r)}>
                    {r} miles
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resultLimit">Number of Results</Label>
              <select
                id="resultLimit"
                value={form.resultLimit}
                onChange={(e) => updateField("resultLimit", e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                {RESULT_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} results
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resultBatch">Result batch</Label>
              <Input
                id="resultBatch"
                type="number"
                min={0}
                placeholder="0"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Batch 0 = first {form.resultLimit} results. Batch 2 skips{" "}
                {Number(form.resultLimit) * 2} listings.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSearch}
              disabled={loading || resetting || (!form.make && !form.model)}
              className="min-w-[220px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scraping Marketplace...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search Facebook Marketplace
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleNextResults}
              disabled={!canGoNext}
              className="min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  Next results
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoToBatch}
              disabled={
                loading ||
                resetting ||
                (!form.make && !form.model)
              }
            >
              Go to batch
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetSession}
              disabled={loading || resetting}
              className="min-w-[220px]"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting Session...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Reset Browser Session
                </>
              )}
            </Button>
          </div>

          {resetMessage && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {resetMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <p>{error}</p>
              {(error.includes("PROFILE_ALREADY_RUNNING") ||
                error.includes("Multilogin")) && (
                <p className="mt-2 text-red-200/80">
                  {error.includes("not running on this machine") ? (
                    <>
                      Install and open <strong>Multilogin X</strong> on the same
                      machine where this app runs, then try again. Market Search
                      does not work from localhost unless Multilogin is running
                      locally (or you point the app at your deployed server).
                    </>
                  ) : (
                    <>
                      Click <strong>Reset Browser Session</strong> above, wait a
                      few seconds, then search again.
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {(loading || hasSearched) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {loading
                ? "Searching..."
                : results.length > 0
                  ? `${results.length} result${results.length !== 1 ? "s" : ""} found`
                  : "No listings in this batch"}
            </CardTitle>
            {!loading && hasSearched && (
              <p className="text-sm text-slate-400">
                Batch {resultBatch}
                {skipCount > 0 && ` — skipped first ${skipCount} listings`}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-slate-400">
                  Launching browser via Multilogin and scraping listings...
                </p>
                <p className="text-xs text-slate-500">
                  {resultBatch > 0
                    ? `Skipping to batch ${resultBatch} may take longer while scrolling past earlier listings.`
                    : "This may take 1–3 minutes depending on filters and result count."}
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="space-y-4 py-8 text-center">
                <p className="text-slate-400">
                  {resultBatch > 0
                    ? "No more listings found for this search."
                    : "No listings matched your filters."}
                </p>
                {resultBatch > 0 && (
                  <p className="text-xs text-slate-500">
                    Try a lower batch number or run a new search from batch 0.
                  </p>
                )}
                {paginationFooter}
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Mileage</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Days Listed</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((listing) => (
                    <TableRow key={listing.url}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {listing.title}
                      </TableCell>
                      <TableCell>{formatCurrency(listing.price)}</TableCell>
                      <TableCell>
                        {listing.mileage
                          ? `${listing.mileage.toLocaleString()} mi`
                          : "—"}
                      </TableCell>
                      <TableCell>{listing.location ?? "—"}</TableCell>
                      <TableCell>
                        {listing.daysListed != null
                          ? `${listing.daysListed}d`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500"
                            title="Message seller on Facebook Marketplace"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Chat on Messenger
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={savedUrls.has(listing.url) ? "secondary" : "outline"}
                          disabled={
                            savingId === listing.url || savedUrls.has(listing.url)
                          }
                          onClick={() => handleSave(listing)}
                        >
                          {savingId === listing.url ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : savedUrls.has(listing.url) ? (
                            "Saved"
                          ) : (
                            <>
                              <Save className="h-3 w-3" />
                              Save to Market Comps
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {paginationFooter}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
