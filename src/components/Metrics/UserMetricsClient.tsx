/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import { formatBytes } from "@/lib/helpers";

type UserMetrics = {
  totals: {
    files: number;
    shortLinks: number;
    tags: number;
    folders: number;
    watchlist: number;
  };
  publicTotals: {
    files: number;
    shortLinks: number;
  };
  storageBytes: number;
  shortLinkClicks: number;
};

const numberFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {helper ? (
          <div className="text-xs text-muted-foreground">{helper}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function UserMetricsClient() {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(apiV1("/profile/metrics"), {
          cache: "no-store",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || "Failed to load metrics");
        }
        const data = (await res.json()) as UserMetrics;
        if (active) setMetrics(data);
      } catch (error) {
        toast.error("Failed to load metrics", {
          description: (error as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Card key={`metric-skeleton-${idx}`}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Storage used"
          value={formatBytes(metrics.storageBytes)}
          helper={`${numberFormat.format(metrics.totals.files)} files`}
        />
        <MetricCard
          label="Short links"
          value={numberFormat.format(metrics.totals.shortLinks)}
          helper={`${numberFormat.format(metrics.shortLinkClicks)} clicks`}
        />
        <MetricCard
          label="Tags"
          value={numberFormat.format(metrics.totals.tags)}
          helper={`${numberFormat.format(metrics.totals.folders)} folders`}
        />
        <MetricCard
          label="Watchlist"
          value={`${numberFormat.format(metrics.totals.watchlist)}`}
          helper="Items tracked"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Public files"
          value={numberFormat.format(metrics.publicTotals.files)}
          helper="Visible in public"
        />
        <MetricCard
          label="Public links"
          value={numberFormat.format(metrics.publicTotals.shortLinks)}
          helper="Shareable short links"
        />
      </div>
    </div>
  );
}
