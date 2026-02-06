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
import PageLayout from "@/components/Common/PageLayout";
import { adminGetMetrics } from "@/lib/client/admin";
import { formatBytes } from "@/lib/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { AdminMetrics } from "@/types/admin-metrics";
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

const numberFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDayLabel(value: string) {
  if (!value) return "";
  return value.slice(5);
}

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

export default function AdminMetricsClient() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await adminGetMetrics();
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

  const chartData = useMemo(() => {
    if (!metrics) return [];
    return metrics.daily.map((row) => ({
      ...row,
      storageMb: Math.round(row.storageBytes / 1_000_000),
    }));
  }, [metrics]);

  return (
    <PageLayout
      title="Server Metrics"
      subtitle="Aggregate usage and storage over the last 30 days"
    >
      {loading ? (
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
      ) : metrics ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total users"
              value={numberFormat.format(metrics.totals.users)}
              helper={`${numberFormat.format(metrics.totals.verifiedUsers)} verified`}
            />
            <MetricCard
              label="Admins"
              value={`${metrics.totals.admins} / ${metrics.totals.owners}`}
              helper="Active elevated roles"
            />
            <MetricCard
              label="Storage used"
              value={formatBytes(metrics.storageBytes)}
              helper={`${numberFormat.format(metrics.totals.files)} files`}
            />
            <MetricCard
              label="Short links"
              value={numberFormat.format(metrics.totals.shortLinks)}
              helper="Total created"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Files & Users (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDayLabel} />
                    <YAxis tickFormatter={(v) => numberFormat.format(v)} />
                    <Tooltip
                      formatter={(value, name) => [
                        numberFormat.format(Number(value)),
                        String(name),
                      ]}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="files"
                      name="Files"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      name="Users"
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
                <CardTitle className="text-base">
                  Storage Added (MB, 30 days)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDayLabel} />
                    <YAxis tickFormatter={(v) => numberFormat.format(v)} />
                    <Tooltip
                      formatter={(value) => [
                        `${numberFormat.format(Number(value))} MB`,
                        "Storage",
                      ]}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Bar
                      dataKey="storageMb"
                      name="Storage MB"
                      fill="var(--color-chart-3)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Content Added (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} />
                  <YAxis tickFormatter={(v) => numberFormat.format(v)} />
                  <Tooltip
                    formatter={(value, name) => [
                      numberFormat.format(Number(value)),
                      String(name),
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="notes"
                    name="Notes"
                    stackId="content"
                    fill="var(--color-chart-1)"
                  />
                  <Bar
                    dataKey="snippets"
                    name="Snippets"
                    stackId="content"
                    fill="var(--color-chart-2)"
                  />
                  <Bar
                    dataKey="bookmarks"
                    name="Bookmarks"
                    stackId="content"
                    fill="var(--color-chart-4)"
                  />
                  <Bar
                    dataKey="shortLinks"
                    name="Short Links"
                    stackId="content"
                    fill="var(--color-chart-5)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageLayout>
  );
}
