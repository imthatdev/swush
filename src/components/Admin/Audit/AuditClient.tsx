/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { AuditRow, VerifyResult } from "@/lib/api/audit";
import { AuditFilters, type AuditFiltersValue } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import { Button } from "@/components/ui/button";

import PageLayout from "@/components/Common/PageLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { apiV1, apiV1Path } from "@/lib/api-path";
import { copyToClipboard } from "@/lib/client/clipboard";

export default function AuditClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<AuditFiltersValue>({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const pFromUrl = Number(searchParams.get("page") || "1");
    if (!Number.isNaN(pFromUrl) && pFromUrl > 0) {
      setPage(pFromUrl);
    }
  }, [searchParams]);

  const setPageAndPush = useCallback(
    (nextPage: number, nextFilters?: AuditFiltersValue) => {
      setPage(nextPage);
      const activeFilters = nextFilters ?? filters;
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("page", String(nextPage));
      if (activeFilters.action) sp.set("action", activeFilters.action);
      else sp.delete("action");
      if (activeFilters.targetType)
        sp.set("targetType", activeFilters.targetType);
      else sp.delete("targetType");
      if (activeFilters.actorId) sp.set("actorId", activeFilters.actorId);
      else sp.delete("actorId");
      if (activeFilters.chainId) sp.set("chainId", activeFilters.chainId);
      else sp.delete("chainId");
      if (activeFilters.q) sp.set("q", activeFilters.q);
      else sp.delete("q");
      sp.set("limit", "25");
      router.replace(`/admin/audit?${sp.toString()}`);
    },
    [filters, router, searchParams],
  );

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.action) p.set("action", filters.action);
    if (filters.targetType) p.set("targetType", filters.targetType);
    if (filters.actorId) p.set("actorId", filters.actorId);
    if (filters.chainId) p.set("chainId", filters.chainId);
    if (filters.q) p.set("q", filters.q);
    p.set("limit", "25");
    p.set("page", String(page));
    return p.toString();
  }, [filters, page]);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [verifyResult, setVerifyResult] = useState<null | {
    type: "ok" | "corrupted" | "legacy";
    message: string;
    details?: string;
  }>(null);
  const [verifySummary, setVerifySummary] = useState<VerifyResult | null>(null);
  const [showInvestigation, setShowInvestigation] = useState(false);
  const [rotating, setRotating] = useState(false);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofData, setProofData] = useState<null | {
    id: string;
    chainId?: string | null;
    seq?: number | null;
    hash: string;
    previousHash: string | null;
    linked: boolean;
    hasPrevious: boolean;
  }>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const url = apiV1(`/audit?${qs}`);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        rows: AuditRow[];
        totalPages: number;
      };
      setRows(data.rows);
      setTotalPages(data.totalPages);
      if (page > data.totalPages && data.totalPages > 0) {
        setPageAndPush(data.totalPages);
      }
    } catch {
      setError(true);
      toast.error("Failed to load logs", {
        description: "The audit route returned an error.",
      });
    } finally {
      setLoading(false);
    }
  }, [page, qs, setPageAndPush]);

  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );
  const brokenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const chain of verifySummary?.chains ?? []) {
      if (chain.brokenAt) ids.add(chain.brokenAt);
    }
    return ids;
  }, [verifySummary]);

  async function fetchProof(id: string) {
    const proofPath = apiV1Path("/audit/proof", id);
    const res = await fetch(`${proofPath}?_t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load proof");
    const data = await res.json();
    if (!data?.ok) throw new Error("No proof available");
    return data as {
      id: string;
      chainId?: string | null;
      seq?: number | null;
      hash: string;
      previousHash: string | null;
      linked: boolean;
      hasPrevious: boolean;
    };
  }

  async function openProof(id: string) {
    try {
      setProofOpen(true);
      setProofLoading(true);
      setProofData(null);
      const data = await fetchProof(id);
      setProofData(data);
    } catch (err) {
      toast.error("Failed to load proof", {
        description: (err as Error).message,
      });
      setProofData(null);
    } finally {
      setProofLoading(false);
    }
  }

  async function verifyEntry(id: string) {
    try {
      const data = await fetchProof(id);
      toast.success(data.linked ? "Entry verified" : "Entry broken", {
        description: data.linked
          ? "Hash linkage looks valid."
          : "Hash linkage is broken.",
      });
    } catch (err) {
      toast.error("Verify failed", {
        description: (err as Error).message,
      });
    }
  }

  async function exportProof(id: string) {
    try {
      const data = await fetchProof(id);
      const row = rowById.get(id);
      const payload = {
        id: data.id,
        chainId: data.chainId ?? null,
        seq: data.seq ?? null,
        hash: data.hash,
        previousHash: data.previousHash,
        linked: data.linked,
        hasPrevious: data.hasPrevious,
        action: row?.action ?? null,
        target: row ? `${row.targetType}:${row.targetId}` : null,
        actorId: row?.actorId ?? null,
        actorRole: row?.actorRole ?? null,
        statusCode: row?.statusCode ?? null,
        createdAt: row?.createdAt ?? null,
        meta: row?.meta ?? null,
      };
      await copyToClipboard(JSON.stringify(payload, null, 2));
      toast.success("Proof copied", {
        description: "JSON proof copied to clipboard.",
      });
    } catch (err) {
      toast.error("Export failed", {
        description: (err as Error).message,
      });
    }
  }

  async function runVerify() {
    try {
      const verifyPath = apiV1("/audit/verify");
      const res = await fetch(`${verifyPath}?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("verify_failed");
      const data = (await res.json()) as VerifyResult;
      setVerifySummary(data);

      if (data.ok && data.corrupted === false) {
        setVerifyResult({
          type: "ok",
          message: `Audit verified ꕀ ${data.count} entries`,
          details: data.activeChainId
            ? `Active chain ${data.activeChainId.slice(0, 8)}…`
            : undefined,
        });
        return;
      }

      if (data.chains?.some((chain) => chain.status === "legacy")) {
        setVerifyResult({
          type: "legacy",
          message: "Legacy entries detected",
          details: "Some logs are missing chain metadata.",
        });
        return;
      }

      if (data.corrupted) {
        const culprit = data.chains.find(
          (chain) => chain.status === "corrupted" && chain.culprit?.id,
        )?.culprit;
        const role = culprit?.actorRole ?? "user";
        const who = culprit?.actorId ?? "(system)";
        const act = culprit?.action ?? "(action)";
        const tgt = `${culprit?.targetType ?? "?"}:${culprit?.targetId ?? "?"}`;
        setVerifyResult({
          type: "corrupted",
          message: `Corrupted ꕀ culprit is log ${culprit?.id ?? "unknown"}`,
          details: `${role} ${who} · ${act} · ${tgt}`,
        });
        return;
      }

      setVerifyResult({
        type: "corrupted",
        message: "Verification result unknown",
      });
    } catch {
      setVerifyResult({
        type: "corrupted",
        message: "Verify failed ꕀ could not check chain",
      });
    }
  }

  async function rotateChain() {
    try {
      setRotating(true);
      const res = await fetch(apiV1("/audit/rotate"), { method: "POST" });
      if (!res.ok) throw new Error("Rotate failed");
      await Promise.all([loadData(), runVerify()]);
      toast.success("New chain started", {
        description: "Audit entries will continue in a fresh chain.",
      });
    } catch (err) {
      toast.error("Rotate failed", {
        description: (err as Error).message,
      });
    } finally {
      setRotating(false);
    }
  }

  useEffect(() => {
    loadData();
    runVerify();
  }, [loadData, qs]);

  return (
    <PageLayout
      title="Audit Logs"
      subtitle="Filter, verify, and inspect tamper-evident logs"
      toolbar={
        <div className="flex flex-col gap-2">
          <AuditFilters
            value={filters}
            onChange={(v) => {
              setFilters(v);
              setPageAndPush(1, v);
            }}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([loadData(), runVerify()]).finally(() =>
                setRefreshing(false),
              );
            }}
            loadData={loadData}
            refreshing={refreshing}
          />
        </div>
      }
    >
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          Failed to load audit rows. Check the server logs and ensure `audit` is
          reachable.
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          {verifyResult && (
            <div
              className={`rounded-md border p-2 text-sm ${
                verifyResult.type === "ok"
                  ? "border-green-500 text-green-700"
                  : verifyResult.type === "legacy"
                    ? "border-amber-500 text-amber-700"
                    : "border-red-500 text-red-700"
              }`}
            >
              <div className="font-medium">{verifyResult.message}</div>
              {verifyResult.details && (
                <div className="text-xs opacity-80">{verifyResult.details}</div>
              )}
            </div>
          )}
          {verifySummary && (
            <div className="text-xs text-muted-foreground">
              {verifySummary.chains.length} chains · {verifySummary.count} total
              entries
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowInvestigation((v) => !v)}
          >
            {showInvestigation ? "Hide Investigation" : "Investigate Chains"}
          </Button>
          <Button variant="outline" onClick={runVerify}>
            Recheck
          </Button>
          <Button variant="outline" onClick={rotateChain} disabled={rotating}>
            {rotating ? "Starting…" : "Start New Chain"}
          </Button>
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPageAndPush(Math.max(page - 1, 1))}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPageAndPush(Math.min(page + 1, totalPages))}
          >
            Next
          </Button>
        </div>
      </div>

      {showInvestigation && verifySummary && (
        <div className="grid gap-2 rounded-md border bg-card p-3 text-sm md:grid-cols-2">
          {verifySummary.chains.map((chain) => {
            const tone =
              chain.status === "ok"
                ? "border-green-500 text-green-700"
                : chain.status === "legacy"
                  ? "border-amber-500 text-amber-700"
                  : "border-red-500 text-red-700";
            const label =
              chain.status === "ok"
                ? "Healthy"
                : chain.status === "legacy"
                  ? "Legacy"
                  : "Corrupted";
            return (
              <div
                key={chain.chainId ?? "legacy"}
                className={`rounded-md border p-3 ${tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{label} chain</div>
                  <div className="text-xs">
                    {chain.count} entries · seq {chain.lastSeq ?? "?"}
                  </div>
                </div>
                <div className="mt-1 break-all text-xs">
                  {chain.chainId ?? "Legacy (missing chainId)"}
                </div>
                {chain.brokenAt && (
                  <div className="mt-1 text-xs">
                    Broken at {chain.brokenAt.slice(0, 8)}…
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {chain.chainId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          chainId: chain.chainId ?? undefined,
                        };
                        setFilters(nextFilters);
                        setPageAndPush(1, nextFilters);
                      }}
                    >
                      Filter chain
                    </Button>
                  )}
                  {filters.chainId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const nextFilters = { ...filters, chainId: undefined };
                        setFilters(nextFilters);
                        setPageAndPush(1, nextFilters);
                      }}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AuditTable
        rows={rows}
        loading={loading}
        error={error}
        onProof={openProof}
        onVerify={verifyEntry}
        onExport={exportProof}
        brokenIds={brokenIds}
      />

      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Proof</DialogTitle>
          </DialogHeader>
          {proofLoading ? (
            <div className="text-sm text-muted-foreground">Loading proof…</div>
          ) : proofData ? (
            <div className="space-y-2 text-sm">
              {proofData.chainId ? (
                <div>
                  <span className="font-medium">Chain:</span>{" "}
                  <span className="font-mono break-all">
                    {proofData.chainId}
                  </span>
                </div>
              ) : null}
              {typeof proofData.seq === "number" ? (
                <div>
                  <span className="font-medium">Sequence:</span>{" "}
                  <span className="font-mono">{proofData.seq}</span>
                </div>
              ) : null}
              <div>
                <span className="font-medium">ID:</span>{" "}
                <span className="font-mono break-all">{proofData.id}</span>
              </div>
              <div>
                <span className="font-medium">Hash:</span>{" "}
                <span className="font-mono break-all">{proofData.hash}</span>
              </div>
              <div>
                <span className="font-medium">Previous Hash:</span>{" "}
                <span className="font-mono break-all">
                  {proofData.previousHash ?? "(none)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Linked:</span>
                {proofData.linked ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-600" />
                    Valid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    Broken
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Has previous: {proofData.hasPrevious ? "yes" : "no"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-destructive">No proof available.</div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
