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
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import { formatBytes } from "@/lib/helpers";

type RangeKey = "24h" | "7d" | "30d" | "90d";

type MetricsResponse = {
  generatedAt: string;
  range: {
    key: RangeKey;
    days: number;
    from: string;
    to: string;
  };
  overview: {
    totalUploads: number;
    totalShortLinks: number;
    totalViewsAndClicks: number;
    periodViews: number;
    periodUniqueViews: number;
    activeItems: number;
    growth: {
      uploadsPct: number;
      shortLinksPct: number;
      viewsPct: number;
      uniqueViewsPct: number;
      activeItemsPct: number;
    };
  };
  totals: {
    files: number;
    bookmarks: number;
    shortLinks: number;
    tags: number;
    folders: number;
    watchlist: number;
    storageBytes: number;
    views: {
      files: number;
      bookmarks: number;
      shortLinks: number;
    };
    publicTotals: {
      files: number;
      bookmarks: number;
      shortLinks: number;
    };
  };
  charts: {
    viewsOverTime: { date: string; views: number; uniqueViews: number }[];
    hourly: { hour: number; label: string; views: number }[];
    topItems: {
      id: string;
      type: string;
      title: string;
      views: number;
      createdAt: string;
      engagementScore: number;
    }[];
  };
  geo: {
    countries: { label: string; views: number; pct: number }[];
    cities: { label: string; views: number; pct: number }[];
  };
  context: {
    sourceTypes: { label: string; views: number; pct: number }[];
    referrerTypes: { label: string; views: number; pct: number }[];
    contentTypes: { label: string; items: number; views: number }[];
    topTags: { label: string; uses: number }[];
  };
  engagement: {
    avgTimeToFirstClickSeconds: number | null;
    repeatViews: number;
    repeatViewRatePct: number;
    returnVisitorRatePct: number | null;
    saveToViewRatio: number | null;
    cohorts: {
      heatmap: {
        cohort: string;
        weekOffset: number;
        week: string;
        active: number;
        cohortSize: number;
        rate: number;
      }[];
      series: {
        cohort: string;
        size: number;
        week0: number;
        week1: number;
        week2: number;
        week3: number;
        week4: number;
        week5: number;
      }[];
    };
  };
  leaderboards: {
    mostViewedItems: {
      id: string;
      type: string;
      title: string;
      views: number;
      createdAt: string;
      engagementScore: number;
    }[];
    mostSharedShortLinks: {
      id: string;
      slug: string;
      clicks: number;
      createdAt: string;
    }[];
    mostSavedContentTypes: { label: string; items: number; views: number }[];
    mostActiveCollections: {
      folderId: string | null;
      name: string;
      items: number;
      views: number;
      storageBytes: number;
    }[];
  };
  collections: {
    folders: {
      folderId: string | null;
      name: string;
      items: number;
      views: number;
      storageBytes: number;
    }[];
  };
  performance: {
    uploads: {
      total: number;
      success: number;
      failed: number;
      successRatePct: number | null;
      avgUploadTimeSeconds: number | null;
      queued: number;
      processing: number;
    };
  };
};

const numberFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "hsl(var(--muted-foreground))",
];

const chartAxisTextColor = "currentColor";
const chartGridColor = "hsl(var(--border))";

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

function formatDayLabel(value: string) {
  if (!value) return "";
  return value.slice(5);
}

function formatTooltipValue(value: string | number | null | undefined) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return compact(parsed);
  return String(value ?? "0");
}

function trimAxisLabel(value: string, maxLength = 18) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
}

function renderMetricsTooltip(params: {
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

function formatTrend(value: number) {
  const rounded = Number.isFinite(value) ? value : 0;
  const arrow = rounded >= 0 ? "↑" : "↓";
  return `${arrow} ${percentFormat.format(Math.abs(rounded))}%`;
}

function trendClass(value: number) {
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-rose-500";
  return "text-muted-foreground";
}

function compact(value: number) {
  return numberFormat.format(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRIBUTION_WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
const MONTH_SHORT_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

const HEATMAP_LEVEL_CLASSES = [
  "border-[#d0d7de] bg-[#ebedf0] dark:border-[#30363d] dark:bg-[#161b22]",
  "border-[#9be9a8] bg-[#9be9a8] dark:border-[#0e4429] dark:bg-[#0e4429]",
  "border-[#40c463] bg-[#40c463] dark:border-[#006d32] dark:bg-[#006d32]",
  "border-[#30a14e] bg-[#30a14e] dark:border-[#26a641] dark:bg-[#26a641]",
  "border-[#216e39] bg-[#216e39] dark:border-[#39d353] dark:bg-[#39d353]",
];

function getHeatLevel(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;

  // Slightly amplify low traffic buckets so sparse activity still gets visible color.
  const normalized = Math.pow(value / max, 0.6);
  if (normalized < 0.25) return 1;
  if (normalized < 0.5) return 2;
  if (normalized < 0.75) return 3;
  return 4;
}

function parseIsoDay(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function formatIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function MetricCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper?: string;
  trend?: number;
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
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">{helper}</div>
          {typeof trend === "number" ? (
            <div className={`text-xs font-medium ${trendClass(trend)}`}>
              {formatTrend(trend)}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ContributionCell({
  date,
  value,
  max,
  hasData,
  isYearDay,
  isFuture,
}: {
  date: string;
  value: number;
  max: number;
  hasData: boolean;
  isYearDay: boolean;
  isFuture: boolean;
}) {
  const level = hasData ? getHeatLevel(value, max) : 0;
  const dayDate = parseIsoDay(date);
  const dayLabel = dayDate.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  if (!isYearDay) {
    return (
      <div className="size-4 rounded-[2px] border border-transparent bg-transparent" />
    );
  }

  return (
    <div
      className={`size-4 rounded-[2px] border ${HEATMAP_LEVEL_CLASSES[level]}`}
      title={
        isFuture
          ? `No data yet for ${dayLabel}`
          : hasData
            ? `${compact(value)} views on ${dayLabel}`
            : `Outside selected range for ${dayLabel}`
      }
      aria-label={
        isFuture
          ? `No data yet for ${dayLabel}`
          : hasData
            ? `${value} views on ${dayLabel}`
            : `Outside selected range for ${dayLabel}`
      }
    />
  );
}

export default function UserMetricsClient() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(apiV1(`/profile/metrics?range=${range}`), {
          cache: "no-store",
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(
            payload?.message || payload?.error || "Failed to load metrics",
          );
        }
        const data = (await res.json()) as MetricsResponse;
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
  }, [range]);

  const topItemChart = useMemo(() => {
    if (!metrics) return [];
    return metrics.charts.topItems.map((row) => ({
      ...row,
      label: row.title.length > 34 ? `${row.title.slice(0, 31)}...` : row.title,
    }));
  }, [metrics]);

  const topCountries = useMemo(() => {
    if (!metrics) return [];
    return metrics.geo.countries.slice(0, 8);
  }, [metrics]);

  const contributionHeatmap = useMemo(() => {
    if (!metrics || metrics.charts.viewsOverTime.length === 0) {
      return {
        weeks: [] as Array<
          Array<{
            date: string;
            value: number;
            hasData: boolean;
            isYearDay: boolean;
            isFuture: boolean;
          }>
        >,
        monthLabels: [] as string[],
        maxDailyViews: 0,
      };
    }

    const rows = metrics.charts.viewsOverTime;
    const viewsByDay = new Map(rows.map((row) => [row.date, row.views]));
    const generatedDay = parseIsoDay(
      formatIsoDay(new Date(metrics.generatedAt)),
    );
    const displayYear = generatedDay.getUTCFullYear();

    const yearStart = new Date(Date.UTC(displayYear, 0, 1));
    const yearEnd = new Date(Date.UTC(displayYear, 11, 31));
    const yearStartMs = yearStart.getTime();
    const yearEndMs = yearEnd.getTime();

    const start = new Date(yearStart);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const end = new Date(yearEnd);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

    const weeks: Array<
      Array<{
        date: string;
        value: number;
        hasData: boolean;
        isYearDay: boolean;
        isFuture: boolean;
      }>
    > = [];
    let week: Array<{
      date: string;
      value: number;
      hasData: boolean;
      isYearDay: boolean;
      isFuture: boolean;
    }> = [];

    for (
      let cursor = start.getTime();
      cursor <= end.getTime();
      cursor += DAY_MS
    ) {
      const date = new Date(cursor);
      const key = formatIsoDay(date);
      const isYearDay = cursor >= yearStartMs && cursor <= yearEndMs;
      const hasData = isYearDay && viewsByDay.has(key);
      const isFuture = isYearDay && cursor > generatedDay.getTime();
      week.push({
        date: key,
        value: hasData ? (viewsByDay.get(key) ?? 0) : 0,
        hasData,
        isYearDay,
        isFuture,
      });

      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    const monthLabels = weeks.map((weekDays, weekIndex) => {
      const firstOfMonth = weekDays.find(
        (day) => day.isYearDay && day.date.endsWith("-01"),
      );
      if (firstOfMonth) {
        return MONTH_SHORT_FORMAT.format(parseIsoDay(firstOfMonth.date));
      }

      if (weekIndex === 0) {
        const firstVisible = weekDays.find((day) => day.isYearDay);
        return firstVisible
          ? MONTH_SHORT_FORMAT.format(parseIsoDay(firstVisible.date))
          : "";
      }

      return "";
    });

    return {
      weeks,
      monthLabels,
      maxDailyViews: Math.max(0, ...rows.map((row) => row.views)),
    };
  }, [metrics]);

  const cohortRows = useMemo(() => {
    if (!metrics) return [];
    return metrics.engagement.cohorts.series.slice(-8);
  }, [metrics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`range-skel-${idx}`} className="h-9 w-16" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, idx) => (
            <Card key={`metric-skel-${idx}`}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.key}
              variant={range === option.key ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {new Date(metrics.generatedAt).toLocaleString()}
        </div>
      </div>
      <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Trend, geo, and context charts are based on tracked visit events
        (short-link visits, public content views, and in-app read events).
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total uploads"
          value={compact(metrics.overview.totalUploads)}
          helper={`Storage ${formatBytes(metrics.totals.storageBytes)}`}
          trend={metrics.overview.growth.uploadsPct}
        />
        <MetricCard
          label="Total short links"
          value={compact(metrics.overview.totalShortLinks)}
          helper={`${compact(metrics.totals.views.shortLinks)} lifetime clicks`}
          trend={metrics.overview.growth.shortLinksPct}
        />
        <MetricCard
          label="Views & clicks"
          value={compact(metrics.overview.totalViewsAndClicks)}
          helper={`${compact(metrics.overview.periodViews)} tracked visits in selected range`}
          trend={metrics.overview.growth.viewsPct}
        />
        <MetricCard
          label="Unique views"
          value={compact(metrics.overview.periodUniqueViews)}
          helper="Approximate unique tracked visitors"
          trend={metrics.overview.growth.uniqueViewsPct}
        />
        <MetricCard
          label="Active assets"
          value={compact(metrics.overview.activeItems)}
          helper="Distinct assets with tracked visits"
          trend={metrics.overview.growth.activeItemsPct}
        />
        <MetricCard
          label="Public content"
          value={compact(
            metrics.totals.publicTotals.files +
              metrics.totals.publicTotals.bookmarks +
              metrics.totals.publicTotals.shortLinks,
          )}
          helper="Publicly visible assets"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracked views over time</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics.charts.viewsOverTime}
                style={{ color: "hsl(var(--foreground))" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayLabel}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <YAxis
                  tickFormatter={(value) => compact(Number(value))}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                      labelPrefix: "Day",
                    })
                  }
                />
                <Legend wrapperStyle={{ color: chartAxisTextColor }} />
                <Line
                  dataKey="views"
                  name="Views"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="uniqueViews"
                  name="Unique views"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top performing items</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topItemChart.slice(0, 8)}
                layout="vertical"
                margin={{ left: 8 }}
                style={{ color: "hsl(var(--foreground))" }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={chartGridColor}
                />
                <XAxis
                  type="number"
                  tickFormatter={(value) => compact(Number(value))}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={160}
                  tickFormatter={(value) => trimAxisLabel(String(value), 24)}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                    })
                  }
                />
                <Bar
                  dataKey="views"
                  name="Views"
                  fill="var(--color-chart-3)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tracked activity contribution heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
              <span>Less</span>
              {HEATMAP_LEVEL_CLASSES.map((levelClass, index) => (
                <span
                  key={`heat-level-${index}`}
                  className={`h-3.5 w-3.5 rounded-[2px] border ${levelClass}`}
                />
              ))}
              <span>More</span>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="w-max space-y-1.5">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `2.2rem repeat(${contributionHeatmap.weeks.length}, 1rem)`,
                  }}
                >
                  <div />
                  {contributionHeatmap.monthLabels.map((label, weekIndex) => (
                    <div
                      key={`month-${weekIndex}`}
                      className="h-4 text-[11px] leading-4 text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `2.2rem repeat(${contributionHeatmap.weeks.length}, 1rem)`,
                  }}
                >
                  <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] text-muted-foreground">
                    {CONTRIBUTION_WEEKDAY_LABELS.map((day) => (
                      <div key={`weekday-${day}`} className="h-4 leading-4">
                        {day}
                      </div>
                    ))}
                  </div>
                  {contributionHeatmap.weeks.map((week, weekIndex) => (
                    <div
                      key={`week-${weekIndex}`}
                      className="grid grid-rows-7 gap-1"
                    >
                      {week.map((day) => (
                        <ContributionCell
                          key={day.date}
                          date={day.date}
                          value={day.value}
                          max={contributionHeatmap.maxDailyViews}
                          hasData={day.hasData}
                          isYearDay={day.isYearDay}
                          isFuture={day.isFuture}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tracked views by country
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCountries}
                layout="vertical"
                style={{ color: "hsl(var(--foreground))" }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={chartGridColor}
                />
                <XAxis
                  type="number"
                  tickFormatter={(value) => compact(Number(value))}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tickFormatter={(value) => trimAxisLabel(String(value), 18)}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                    })
                  }
                />
                <Bar
                  dataKey="views"
                  name="Views"
                  fill="var(--color-chart-4)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source type</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.context.sourceTypes}
                  dataKey="views"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {metrics.context.sourceTypes.map((row, index) => (
                    <Cell
                      key={`${row.label}-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                    })
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrer context</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.context.referrerTypes}
                  dataKey="views"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {metrics.context.referrerTypes.map((row, index) => (
                    <Cell
                      key={`${row.label}-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                    })
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.context.contentTypes.slice(0, 6)}
                style={{ color: "hsl(var(--foreground))" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                  tickFormatter={(value) => trimAxisLabel(String(value), 12)}
                />
                <YAxis
                  tickFormatter={(value) => compact(Number(value))}
                  tick={{ fill: chartAxisTextColor, fontSize: 12 }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={{ stroke: chartGridColor }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, label, payload }) =>
                    renderMetricsTooltip({
                      active,
                      label,
                      payload: payload as
                        | readonly TooltipPayloadItem[]
                        | undefined,
                    })
                  }
                />
                <Legend wrapperStyle={{ color: chartAxisTextColor }} />
                <Bar dataKey="items" name="Items" fill="var(--color-chart-1)" />
                <Bar dataKey="views" name="Views" fill="var(--color-chart-5)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Avg time to first click"
          value={
            metrics.engagement.avgTimeToFirstClickSeconds == null
              ? "-"
              : `${percentFormat.format(metrics.engagement.avgTimeToFirstClickSeconds)}s`
          }
          helper="From short-link create to first visit"
        />
        <MetricCard
          label="Repeat views"
          value={compact(metrics.engagement.repeatViews)}
          helper={`${percentFormat.format(metrics.engagement.repeatViewRatePct)}% of tracked views`}
        />
        <MetricCard
          label="Return visitors"
          value={
            metrics.engagement.returnVisitorRatePct == null
              ? "-"
              : `${percentFormat.format(metrics.engagement.returnVisitorRatePct)}%`
          }
          helper="Visitors active on multiple days"
        />
        <MetricCard
          label="Save-to-view ratio"
          value={
            metrics.engagement.saveToViewRatio == null
              ? "-"
              : `${percentFormat.format(metrics.engagement.saveToViewRatio)}x`
          }
          helper="Created items divided by range views"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort retention (weekly)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 overflow-x-auto">
          <div className="min-w-160 space-y-1">
            <div className="grid grid-cols-[120px_repeat(6,minmax(0,1fr))] gap-1 text-xs text-muted-foreground">
              <div>Cohort</div>
              <div className="text-center">W0</div>
              <div className="text-center">W1</div>
              <div className="text-center">W2</div>
              <div className="text-center">W3</div>
              <div className="text-center">W4</div>
              <div className="text-center">W5</div>
            </div>
            {cohortRows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">
                Not enough retention data in this range.
              </div>
            ) : (
              cohortRows.map((row) => {
                const values = [
                  row.week0,
                  row.week1,
                  row.week2,
                  row.week3,
                  row.week4,
                  row.week5,
                ];
                return (
                  <div
                    key={row.cohort}
                    className="grid grid-cols-[120px_repeat(6,minmax(0,1fr))] gap-1"
                  >
                    <div className="text-xs text-muted-foreground flex items-center">
                      {row.cohort.slice(5)} ({compact(row.size)})
                    </div>
                    {values.map((value, index) => (
                      <div
                        key={`${row.cohort}-w${index}`}
                        className="h-8 rounded-sm border border-border/40 flex items-center justify-center text-[11px]"
                        style={{
                          backgroundColor: `hsl(var(--primary) / ${0.1 + (value / 100) * 0.65})`,
                        }}
                      >
                        {percentFormat.format(value)}%
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top content leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.leaderboards.mostViewedItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No content yet.
              </div>
            ) : (
              metrics.leaderboards.mostViewedItems
                .slice(0, 8)
                .map((item, idx) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {idx + 1}. {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.type} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString()} · Score{" "}
                        {item.engagementScore}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {compact(item.views)}
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections / folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.collections.folders.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No folder data yet.
              </div>
            ) : (
              metrics.collections.folders.slice(0, 8).map((folder) => (
                <div
                  key={folder.folderId || "uncategorized"}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {folder.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {compact(folder.items)} items ·{" "}
                      {formatBytes(folder.storageBytes)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {compact(folder.views)} views
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Upload jobs"
              value={compact(metrics.performance.uploads.total)}
              helper="In selected range"
            />
            <MetricCard
              label="Upload success rate"
              value={
                metrics.performance.uploads.successRatePct == null
                  ? "-"
                  : `${percentFormat.format(metrics.performance.uploads.successRatePct)}%`
              }
              helper={`${compact(metrics.performance.uploads.success)} success · ${compact(metrics.performance.uploads.failed)} failed`}
            />
            <MetricCard
              label="Avg upload time"
              value={
                metrics.performance.uploads.avgUploadTimeSeconds == null
                  ? "-"
                  : `${percentFormat.format(metrics.performance.uploads.avgUploadTimeSeconds)}s`
              }
              helper="Completed remote upload jobs"
            />
            <MetricCard
              label="Queue status"
              value={`${compact(metrics.performance.uploads.queued)} queued`}
              helper={`${compact(metrics.performance.uploads.processing)} processing`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top tags</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.context.topTags.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No tag data yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {metrics.context.topTags.map((tag) => (
                  <span
                    key={tag.label}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
                  >
                    #{tag.label}
                    <span className="text-muted-foreground">
                      {compact(tag.uses)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
