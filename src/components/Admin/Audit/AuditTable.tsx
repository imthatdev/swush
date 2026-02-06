/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import {
  IconAlertTriangle,
  IconCopy,
  IconJson,
  IconPoo,
  IconRosetteDiscountCheck,
} from "@tabler/icons-react";
import type { AuditRow } from "@/lib/api/audit";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/client/clipboard";

export function AuditTable({
  rows = [],
  loading,
  error,
  onProof,
  onVerify,
  onExport,
  brokenIds,
}: {
  rows?: AuditRow[];
  loading: boolean;
  error: boolean;
  onProof: (id: string) => void;
  onVerify?: (id: string) => void;
  onExport?: (id: string) => void;
  brokenIds?: Set<string>;
}) {
  const isBroken = (id: string) => (brokenIds ? brokenIds.has(id) : false);

  const handleCopy = async (text: string) => {
    try {
      await copyToClipboard(text);
      toast.success("Copied to clipboard", {
        description: text,
      });
    } catch (err) {
      toast.error("Copy failed", {
        description: (err as Error)?.message || "Clipboard unavailable",
      });
    }
  };

  return (
    <div className="rounded-md border bg-card text-sm">
      <div className="min-w-[90vw] overflow-x-auto">
        <Table className="min-w-screen sm:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="hidden md:table-cell">ID</TableHead>
              <TableHead className="hidden md:table-cell">Actor</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden md:table-cell">Chain</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="hidden md:table-cell">Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-destructive">
                  Failed to load audit rows.
                </TableCell>
              </TableRow>
            )}
            {!error && rows.length === 0 && !loading && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground"
                >
                  No audit rows found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, idx) => (
              <TableRow
                key={row.id}
                className={idx % 2 === 1 ? "bg-muted/40" : undefined}
              >
                <TableCell className="w-8 text-center align-middle">
                  {isBroken(row.id) ? (
                    <IconAlertTriangle
                      className="h-4 w-4 text-amber-600"
                      aria-label="Broken link"
                    />
                  ) : null}
                </TableCell>
                <TableCell
                  onClick={() => handleCopy(row.id)}
                  className="hidden md:table-cell font-mono text-xs break-all cursor-pointer"
                >
                  {row.id.slice(0, 8)}…
                </TableCell>
                <TableCell
                  onClick={() => handleCopy(row.actorId ?? "(anonymous)")}
                  className="hidden md:table-cell cursor-pointer"
                >
                  {row.actorId?.slice(0, 8) ?? "(anonymous)"}...
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {row.actorRole ?? "user"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs">
                  <div className="font-mono">
                    {row.chainId ? `${row.chainId.slice(0, 8)}…` : "legacy"}
                  </div>
                  <div className="text-muted-foreground">seq {row.seq ?? "?"}</div>
                </TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell className="break-all">
                  {row.targetType}:{row.targetId}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {row.statusCode ?? ""}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono break-all">
                  {row.hash?.slice(0, 10)}…
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onProof(row.id)}
                    >
                      <IconPoo />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(row.hash)}
                      title="Copy hash"
                    >
                      <IconCopy />
                    </Button>
                    {onVerify && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onVerify(row.id)}
                      >
                        <IconRosetteDiscountCheck />
                      </Button>
                    )}
                    {onExport && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onExport(row.id)}
                      >
                        <IconJson />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} rows`}
        </div>
      </div>
    </div>
  );
}
