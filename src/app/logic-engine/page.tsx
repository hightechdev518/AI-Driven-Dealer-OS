"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { LogicRule } from "@/lib/logic-engine/types";

const CATEGORY_COLORS: Record<string, string> = {
  inventory: "bg-slate-700 text-slate-200",
  pricing: "bg-orange-500/20 text-orange-400",
  leads: "bg-red-500/20 text-red-400",
  acquisition: "bg-emerald-500/20 text-emerald-400",
};

export default function LogicEnginePage() {
  const [rules, setRules] = useState<LogicRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleDescription, setRuleDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logic-engine/rules");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load rules");
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleCreateRule = async () => {
    if (!ruleDescription.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/logic-engine/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: ruleDescription.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create rule");

      setRules((prev) => [...prev, data]);
      setRuleDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setCreating(false);
    }
  };

  const handleRunRules = async () => {
    setRunning(true);
    setError(null);
    setRunResult(null);

    try {
      const res = await fetch("/api/logic-engine/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run rules");

      setRunResult(
        `Applied rules to ${data.updated} vehicle${data.updated !== 1 ? "s" : ""}. Inventory priorities updated.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run rules");
    } finally {
      setRunning(false);
    }
  };

  const activeRules = rules.filter((rule) => rule.active);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading logic engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-white">Logic Engine</h1>
          </div>
          <p className="mt-1 text-slate-400">
            Automated rules for pricing, inventory, leads, and acquisition
          </p>
        </div>
        <Button
          onClick={handleRunRules}
          disabled={running}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Play className="mr-2 h-4 w-4" />
          {running ? "Running Rules..." : "Run Rules"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          {error}
        </div>
      )}

      {runResult && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-orange-300">
          {runResult}
        </div>
      )}

      <Card className="border-orange-500/20 bg-navy-light/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Create Rule with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='e.g. "If a truck has been in stock over 60 days and has zero leads, mark it for auction"'
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            rows={3}
            className="border-slate-700 bg-slate-900/50 text-white placeholder:text-slate-500"
          />
          <Button
            onClick={handleCreateRule}
            disabled={creating || !ruleDescription.trim()}
            variant="outline"
            className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
          >
            {creating ? "Creating..." : "Create Rule with AI"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Active Rules ({activeRules.length})
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeRules.map((rule) => (
            <Card
              key={rule.id}
              className="border-slate-800 bg-navy-light/30 transition-colors hover:border-orange-500/30"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg text-white">
                    {rule.name}
                  </CardTitle>
                  <Badge
                    className={
                      CATEGORY_COLORS[rule.category] ??
                      "bg-slate-700 text-slate-200"
                    }
                  >
                    {rule.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-300">
                  {rule.summary}
                </p>
                <div className="space-y-1 rounded-lg bg-slate-900/50 p-3 text-xs">
                  <p className="text-slate-500">
                    <span className="font-medium text-orange-500/80">IF</span>{" "}
                    {rule.condition}
                  </p>
                  <p className="text-slate-500">
                    <span className="font-medium text-orange-500/80">
                      THEN
                    </span>{" "}
                    {rule.action}
                  </p>
                </div>
                {!rule.builtIn && (
                  <Badge variant="outline" className="text-slate-400">
                    Custom AI Rule
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
