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

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ItemAnalyticsType = "file" | "bookmark" | "short_link";

type ItemAnalyticsRange = "24h" | "7d" | "30d";

type DimensionRow = {
  label: string;
  views: number;
  pct: number;
};

type TimeSeriesRow = {
  bucket: string;
  label: string;
  views: number;
  uniqueVisitors: number;
};

type ItemAnalyticsPayload = {
  generatedAt: string;
  range: ItemAnalyticsRange;
  item: {
    id: string;
    itemType: ItemAnalyticsType;
    title: string;
    subtitle: string | null;
    slug: string | null;
    contentType: string;
    lifetimeViews: number;
  };
  summary: {
    trackedViews: number;
    uniqueVisitors: number;
    repeatVisitors: number;
    repeatViews: number;
    lastEventAt: string | null;
  };
  contentTypes: DimensionRow[];
  timeSeries: TimeSeriesRow[];
  referrers: DimensionRow[];
  countries: DimensionRow[];
  cities: DimensionRow[];
  sources: DimensionRow[];
  browsers: DimensionRow[];
  operatingSystems: DimensionRow[];
};

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

const RANGE_OPTIONS: Array<{ value: ItemAnalyticsRange; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatLastSeen(value: string | null) {
  if (!value) return "No events yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No events yet";
  return parsed.toLocaleString();
}

function formatTooltipValue(value: string | number | null | undefined) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed.toLocaleString();
  return String(value ?? "0");
}

function renderChartTooltip(params: {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipPayloadItem[];
}) {
  const { active, label, payload } = params;
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 shadow-lg">
      {label ? (
        <p className="mb-1 text-xs font-medium">{String(label)}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div
            key={`${String(item.name ?? "value")}-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color || "hsl(var(--primary))" }}
            />
            <span className="text-popover-foreground/85">
              {String(item.name ?? "Value")}:
            </span>
            <span className="font-semibold text-popover-foreground">
              {formatTooltipValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionListCard({
  title,
  rows,
}: {
  title: string;
  rows: DimensionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length ? (
          rows.slice(0, 6).map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate" title={row.label}>
                  {row.label}
                </span>
                <span className="text-muted-foreground">
                  {formatNumber(row.views)} ({row.pct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-1.5 rounded bg-muted">
                <div
                  className="h-1.5 rounded bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No data in this range.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ItemAnalyticsDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: ItemAnalyticsType;
  itemId: string;
  itemTitle: string;
}) {
  const [range, setRange] = useState<ItemAnalyticsRange>("30d");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemAnalyticsPayload | null>(null);

  useEffect(() => {
    if (!open || !itemId.trim()) {
      setData(null);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          itemType,
          itemId,
          range,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });

        const response = await fetch(
          apiV1(`/item-analytics?${params.toString()}`),
          {
            cache: "no-store",
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          data?: ItemAnalyticsPayload;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load item analytics");
        }

        if (active) setData(payload.data ?? null);
      } catch (error) {
        if (active) {
          setData(null);
          toast.error(
            (error as Error).message || "Failed to load item analytics",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [open, itemId, itemType, range]);

  useEffect(() => {
    if (!open) setRange("30d");
  }, [open]);

  const chartRows = useMemo(
    () =>
      (data?.timeSeries ?? []).map((row) => ({
        label: row.label,
        Views: row.views,
        "Unique Visitors": row.uniqueVisitors,
      })),
    [data?.timeSeries],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-352 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl">View Analytics</DialogTitle>
              <DialogDescription>
                {itemTitle}
                {data?.item?.contentType ? ` - ${data.item.contentType}` : ""}
              </DialogDescription>
            </div>
            <Select
              value={range}
              onValueChange={(value) => setRange(value as ItemAnalyticsRange)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data?.item ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{data.item.contentType}</Badge>
              <span>
                Lifetime views: {formatNumber(data.item.lifetimeViews)}
              </span>
              <span>
                Last event: {formatLastSeen(data.summary.lastEventAt)}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-72 w-full" />
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-5 w-36" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 4 }).map((__, rowIndex) => (
                      <Skeleton key={rowIndex} className="h-4 w-full" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Tracked views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatNumber(data.summary.trackedViews)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In selected range
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Unique visitors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatNumber(data.summary.uniqueVisitors)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fingerprint-based estimate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Repeat visitors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatNumber(data.summary.repeatVisitors)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Visitors with 2+ views
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Repeat views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatNumber(data.summary.repeatViews)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Extra views beyond first visit
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Views Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-80 w-full min-w-0 p-2 sm:p-4">
                {chartRows.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minHeight={260}
                  >
                    <LineChart data={chartRows} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: "currentColor" }}
                        minTickGap={16}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: "currentColor" }}
                      />
                      <Tooltip
                        content={({ active, label, payload }) =>
                          renderChartTooltip({
                            active,
                            label,
                            payload: payload as
                              | readonly TooltipPayloadItem[]
                              | undefined,
                          })
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="Views"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2.4}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Unique Visitors"
                        stroke="var(--color-chart-4)"
                        strokeWidth={2.2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No events in this range.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <DimensionListCard title="Top Referrers" rows={data.referrers} />
              <DimensionListCard title="Top Countries" rows={data.countries} />
              <DimensionListCard title="Top Cities" rows={data.cities} />
              <DimensionListCard title="Sources" rows={data.sources} />
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No analytics data available.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
