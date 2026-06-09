import { Suspense } from "react";
import MarketSearchContent from "./market-search-content";

export default function MarketSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-slate-400">Loading...</div>
      }
    >
      <MarketSearchContent />
    </Suspense>
  );
}
