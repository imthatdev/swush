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

import { useCallback, useState } from "react";
import type { Upload } from "@/types";
import { apiV1 } from "@/lib/api-path";

export function useBulkDelete(
  items: Upload[],
  setItems: React.Dispatch<React.SetStateAction<Upload[]>>,
  selectedIds: Set<string>,
  clearSelection: () => void
) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const keyFor = useCallback(
    (f: Upload) => (f.slug ? String(f.slug) : f.id),
    []
  );

  const confirmBulkDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const mapById = new Map(items.map((f) => [f.id, f] as const));
    const ids = Array.from(selectedIds);

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const f = mapById.get(id);
        if (!f) return { id, ok: false };
        const res = await fetch(apiV1(`/files/${keyFor(f)}`), {
          method: "DELETE",
        });
        return { id, ok: res.ok };
      })
    );

    const okIds = results
      .filter(
        (r): r is PromiseFulfilledResult<{ id: string; ok: boolean }> =>
          r.status === "fulfilled" && r.value.ok
      )
      .map((r) => r.value.id);

    if (okIds.length) {
      setItems((prev) => prev.filter((f) => !okIds.includes(f.id)));
    }

    clearSelection();
    setShowDeleteDialog(false);
  }, [items, selectedIds, keyFor, setItems, clearSelection]);

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    confirmBulkDelete,
    bulkDelete,
  };
}
