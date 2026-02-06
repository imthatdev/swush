/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   You may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";

export type AuditFiltersValue = {
  action?: string;
  targetType?: string;
  actorId?: string;
  chainId?: string;
  q?: string;
};

export function AuditFilters({
  value,
  onChange,
  onRefresh,
  loadData,
  refreshing = false,
}: {
  value: AuditFiltersValue;
  onChange: (v: AuditFiltersValue) => void;
  onRefresh: () => void;
  loadData: () => Promise<void>;
  refreshing?: boolean;
}) {
  const [local, setLocal] = useState<AuditFiltersValue>(value);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => setLocal(value), [value]);

  async function resetLogs() {
    setIsResetting(true);
    try {
      const res = await fetch(apiV1("/audit/reset"), { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      await loadData();
      toast.success("Logs reset", {
        description: "All audit entries were deleted.",
      });
    } catch {
      toast.error("Reset failed", {
        description: "Could not reset logs.",
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        placeholder="Action (e.g., auth:login)"
        value={local.action ?? ""}
        onChange={(e) =>
          setLocal((s) => ({ ...s, action: e.target.value || undefined }))
        }
      />
      <Input
        placeholder="Target Type (e.g., user, bookmark)"
        value={local.targetType ?? ""}
        onChange={(e) =>
          setLocal((s) => ({ ...s, targetType: e.target.value || undefined }))
        }
      />
      <Input
        placeholder="Actor ID"
        value={local.actorId ?? ""}
        onChange={(e) =>
          setLocal((s) => ({ ...s, actorId: e.target.value || undefined }))
        }
      />
      <Input
        placeholder="Chain ID"
        value={local.chainId ?? ""}
        onChange={(e) =>
          setLocal((s) => ({ ...s, chainId: e.target.value || undefined }))
        }
      />
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search meta (ILIKE)"
          value={local.q ?? ""}
          onChange={(e) =>
            setLocal((s) => ({ ...s, q: e.target.value || undefined }))
          }
        />

        <Button
          variant="outline"
          onClick={() => {
            onChange(local);
            onRefresh();
          }}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={isResetting}
              title="Deletes all audit logs"
            >
              {isResetting ? "Resetting…" : "Reset"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all audit logs?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                entire audit history for this project. Consider exporting first
                if you need a backup.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={resetLogs} disabled={isResetting}>
                {isResetting ? "Deleting…" : "Delete logs"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
