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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type AnalyticsDimensionRow = {
  label: string;
  count: number;
  byLink: Record<string, number>;
};

type AnalyticsTimeRow = {
  date: string;
  total: number;
  byLink: Record<string, number>;
};

type AnalyticsLinkMeta = {
  id: string;
  slug: string;
  originalUrl: string;
  clickCount: number;
  trackedClicks: number;
};

type ShortLinkAnalyticsPayload = {
  generatedAt: string;
  days: number;
  links: AnalyticsLinkMeta[];
  totalTrackedClicks: number;
  timeSeries: AnalyticsTimeRow[];
  browsers: AnalyticsDimensionRow[];
  operatingSystems: AnalyticsDimensionRow[];
  referrers: AnalyticsDimensionRow[];
  utmSources: AnalyticsDimensionRow[];
  countries: AnalyticsDimensionRow[];
  cities: AnalyticsDimensionRow[];
};

type DimensionSort = "count_desc" | "count_asc" | "label_asc" | "label_desc";
type TimeOrder = "asc" | "desc";
type AnalyticsTab =
  | "day"
  | "browser"
  | "os"
  | "referrer"
  | "utm"
  | "country"
  | "city";

const colorCycle = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const chartAxisTextColor = "currentColor";
const chartGridColor = "hsl(var(--border))";

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

function formatTooltipValue(value: string | number | null | undefined) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed.toLocaleString();
  return String(value ?? "0");
}

function renderAnalyticsTooltip(params: {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipPayloadItem[];
  labelPrefix?: string;
}) {
  const { active, label, payload, labelPrefix } = params;
  if (!active || !payload?.length) return null;

  const resolvedLabel =
    typeof label === "string" || typeof label === "number" ? String(label) : "";

  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 shadow-lg">
      {resolvedLabel ? (
        <p className="mb-1 text-xs font-medium">
          {labelPrefix ? `${labelPrefix} ${resolvedLabel}` : resolvedLabel}
        </p>
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

function dayLabel(value: string) {
  if (!value) return "";
  return value.slice(5);
}

function trimAxisLabel(value: string, maxLength = 18) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
}

function sortDimensionRows(
  rows: AnalyticsDimensionRow[],
  order: DimensionSort,
) {
  return [...rows].sort((a, b) => {
    if (order === "count_asc") {
      return a.count - b.count || a.label.localeCompare(b.label);
    }
    if (order === "label_asc") {
      return a.label.localeCompare(b.label) || b.count - a.count;
    }
    if (order === "label_desc") {
      return b.label.localeCompare(a.label) || b.count - a.count;
    }
    return b.count - a.count || a.label.localeCompare(b.label);
  });
}

function DimensionCard({
  title,
  rows,
  links,
  chartsReady,
}: {
  title: string;
  rows: AnalyticsDimensionRow[];
  links: AnalyticsLinkMeta[];
  chartsReady: boolean;
}) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data in this range.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = rows.map((row) => ({
    label: row.label,
    total: row.count,
    ...row.byLink,
  }));

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80 min-h-80 min-w-0 w-full p-2 text-foreground sm:h-96 sm:min-h-96 sm:p-4">
        {!chartsReady ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={260}
            minHeight={240}
            debounce={50}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
              style={{ color: "hsl(var(--foreground))" }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke={chartGridColor}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                axisLine={{ stroke: chartGridColor }}
                tickLine={{ stroke: chartGridColor }}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={104}
                tickFormatter={(value) => trimAxisLabel(String(value), 16)}
                tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                axisLine={{ stroke: chartGridColor }}
                tickLine={{ stroke: chartGridColor }}
              />
              <Tooltip
                cursor={false}
                content={({ active, label, payload }) =>
                  renderAnalyticsTooltip({
                    active,
                    label,
                    payload: payload as
                      | readonly TooltipPayloadItem[]
                      | undefined,
                  })
                }
              />
              <Legend wrapperStyle={{ color: chartAxisTextColor }} />
              {links.length > 1 ? (
                links.map((link, index) => (
                  <Bar
                    key={`${title}-${link.id}`}
                    dataKey={link.id}
                    name={link.slug}
                    stackId="group"
                    fill={colorCycle[index % colorCycle.length]}
                    radius={[0, 4, 4, 0]}
                  />
                ))
              ) : (
                <Bar
                  dataKey="total"
                  name="Views"
                  fill="var(--color-chart-2)"
                  radius={[0, 4, 4, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShortLinkAnalyticsDialog({
  open,
  onOpenChange,
  linkIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkIds: string[];
}) {
  const [days, setDays] = useState("30");
  const [timeOrder, setTimeOrder] = useState<TimeOrder>("asc");
  const [contextSort, setContextSort] = useState<DimensionSort>("count_desc");
  const [locationSort, setLocationSort] = useState<DimensionSort>("count_desc");
  const [topN, setTopN] = useState("10");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShortLinkAnalyticsPayload | null>(null);
  const [chartsReady, setChartsReady] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("day");

  const normalizedIds = useMemo(
    () => Array.from(new Set(linkIds.map((id) => id.trim()).filter(Boolean))),
    [linkIds],
  );

  useEffect(() => {
    if (!open || normalizedIds.length === 0) {
      setData(null);
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      try {
        const idsParam = normalizedIds.join(",");
        const response = await fetch(
          apiV1(
            `/shorten/analytics?ids=${encodeURIComponent(idsParam)}&days=${encodeURIComponent(days)}`,
          ),
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          data?: ShortLinkAnalyticsPayload;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load analytics");
        }

        if (active) setData(payload.data ?? null);
      } catch (error) {
        if (active) {
          setData(null);
          toast.error((error as Error).message || "Failed to load analytics");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [open, normalizedIds, days]);

  useEffect(() => {
    if (!open) {
      setChartsReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setChartsReady(true);
    }, 140);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setAnalyticsTab("day");
  }, [open, normalizedIds]);

  const chartLinks = data?.links ?? [];
  const topValue = Number(topN);

  const timeSeriesRows = useMemo(() => {
    if (!data?.timeSeries?.length) return [];
    const sorted = [...data.timeSeries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    if (timeOrder === "desc") sorted.reverse();
    return sorted.map((row) => ({
      date: row.date,
      total: row.total,
      ...row.byLink,
    }));
  }, [data?.timeSeries, timeOrder]);

  const browsers = useMemo(
    () =>
      sortDimensionRows(data?.browsers ?? [], contextSort).slice(0, topValue),
    [data?.browsers, contextSort, topValue],
  );
  const operatingSystems = useMemo(
    () =>
      sortDimensionRows(data?.operatingSystems ?? [], contextSort).slice(
        0,
        topValue,
      ),
    [data?.operatingSystems, contextSort, topValue],
  );
  const referrers = useMemo(
    () =>
      sortDimensionRows(data?.referrers ?? [], contextSort).slice(0, topValue),
    [data?.referrers, contextSort, topValue],
  );
  const utmSources = useMemo(
    () =>
      sortDimensionRows(data?.utmSources ?? [], contextSort).slice(0, topValue),
    [data?.utmSources, contextSort, topValue],
  );
  const countries = useMemo(
    () =>
      sortDimensionRows(data?.countries ?? [], locationSort).slice(0, topValue),
    [data?.countries, locationSort, topValue],
  );
  const cities = useMemo(
    () =>
      sortDimensionRows(data?.cities ?? [], locationSort).slice(0, topValue),
    [data?.cities, locationSort, topValue],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 right-0 top-0 h-dvh w-auto max-w-none translate-x-0 translate-y-0 overflow-x-hidden overflow-y-auto rounded-none p-3 sm:left-[50%] sm:right-auto sm:top-[50%] sm:h-[92vh] sm:w-[98vw] sm:max-w-[98vw] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6 xl:min-w-[92vw] 2xl:min-w-440 2xl:max-w-480">
        <DialogHeader>
          <DialogTitle>Short Link Analytics</DialogTitle>
          <DialogDescription>
            Explore views over time and compare context and location analytics
            across selected short links.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={timeOrder}
            onValueChange={(value) => setTimeOrder(value as TimeOrder)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Time order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Date asc</SelectItem>
              <SelectItem value="desc">Date desc</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={contextSort}
            onValueChange={(value) => setContextSort(value as DimensionSort)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Context order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count_desc">Context: highest views</SelectItem>
              <SelectItem value="count_asc">Context: lowest views</SelectItem>
              <SelectItem value="label_asc">Context: A to Z</SelectItem>
              <SelectItem value="label_desc">Context: Z to A</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={locationSort}
            onValueChange={(value) => setLocationSort(value as DimensionSort)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Location order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count_desc">
                Location: highest views
              </SelectItem>
              <SelectItem value="count_asc">Location: lowest views</SelectItem>
              <SelectItem value="label_asc">Location: A to Z</SelectItem>
              <SelectItem value="label_desc">Location: Z to A</SelectItem>
            </SelectContent>
          </Select>

          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Top" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={`short-link-analytics-skeleton-${index}`}>
                <CardHeader>
                  <Skeleton className="h-5 w-36" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-72 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data ? (
          <div className="min-w-0 space-y-3">
            <Tabs
              value={analyticsTab}
              onValueChange={(value) => setAnalyticsTab(value as AnalyticsTab)}
              className="space-y-3"
            >
              <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
                <TabsList className="inline-flex h-auto min-w-max justify-start gap-1 whitespace-nowrap rounded-md border border-border/50 p-1">
                  <TabsTrigger value="day">By Day</TabsTrigger>
                  <TabsTrigger value="browser">By Browser</TabsTrigger>
                  <TabsTrigger value="os">By OS</TabsTrigger>
                  <TabsTrigger value="referrer">By Referrer</TabsTrigger>
                  <TabsTrigger value="utm">By UTM Source</TabsTrigger>
                  <TabsTrigger value="country">By Country</TabsTrigger>
                  <TabsTrigger value="city">By City</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="day" className="mt-0 min-w-0">
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-base">By Day</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80 min-h-80 min-w-0 w-full p-2 text-foreground sm:h-96 sm:min-h-96 sm:p-4">
                    {timeSeriesRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No daily analytics in the selected range.
                      </p>
                    ) : !chartsReady ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={260}
                        minHeight={240}
                        debounce={50}
                      >
                        <LineChart
                          data={timeSeriesRows}
                          style={{ color: "hsl(var(--foreground))" }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={chartGridColor}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={dayLabel}
                            tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                            axisLine={{ stroke: chartGridColor }}
                            tickLine={{ stroke: chartGridColor }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                            axisLine={{ stroke: chartGridColor }}
                            tickLine={{ stroke: chartGridColor }}
                          />
                          <Tooltip
                            cursor={false}
                            content={({ active, label, payload }) =>
                              renderAnalyticsTooltip({
                                active,
                                label,
                                payload: payload as
                                  | readonly TooltipPayloadItem[]
                                  | undefined,
                                labelPrefix: "Day",
                              })
                            }
                          />
                          <Legend
                            wrapperStyle={{ color: chartAxisTextColor }}
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total"
                            stroke="var(--color-chart-5)"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 3"
                          />
                          {chartLinks.map((link, index) => (
                            <Line
                              key={`line-tab-${link.id}`}
                              type="monotone"
                              dataKey={link.id}
                              name={link.slug}
                              stroke={colorCycle[index % colorCycle.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="browser" className="mt-0 min-w-0">
                <DimensionCard
                  title="By Browser"
                  rows={browsers}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>

              <TabsContent value="os" className="mt-0 min-w-0">
                <DimensionCard
                  title="By OS"
                  rows={operatingSystems}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>

              <TabsContent value="referrer" className="mt-0 min-w-0">
                <DimensionCard
                  title="By Referrer"
                  rows={referrers}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>

              <TabsContent value="utm" className="mt-0 min-w-0">
                <DimensionCard
                  title="By UTM Source"
                  rows={utmSources}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>

              <TabsContent value="country" className="mt-0 min-w-0">
                <DimensionCard
                  title="By Country"
                  rows={countries}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>

              <TabsContent value="city" className="mt-0 min-w-0">
                <DimensionCard
                  title="By City"
                  rows={cities}
                  links={chartLinks}
                  chartsReady={chartsReady}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select one or more links to view analytics.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
