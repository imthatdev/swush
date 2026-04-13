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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Id = string | null | undefined;
export type ToggleOneOptions = {
  shiftKey?: boolean;
  orderedIds?: Id[];
};

export function useBulkSelect() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastInteractedIdRef = useRef<string | null>(null);
  const shiftPressedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftPressedRef.current = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftPressedRef.current = false;
    };

    const onWindowBlur = () => {
      shiftPressedRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  const isSelected = useCallback(
    (id?: Id) => !!id && selectedIds.includes(id),
    [selectedIds],
  );

  const toggleOne = useCallback((id?: Id, options: ToggleOneOptions = {}) => {
    if (!id) return;
    const targetId = String(id);
    const orderedIds = Array.from(
      new Set(
        (options.orderedIds ?? []).filter(Boolean).map((item) => String(item)),
      ),
    );
    const shouldRangeSelect = Boolean(
      options.shiftKey ?? shiftPressedRef.current,
    );

    setSelectedIds((prev) => {
      const anchorId = lastInteractedIdRef.current;

      if (shouldRangeSelect && anchorId && orderedIds.length > 0) {
        const anchorIndex = orderedIds.indexOf(anchorId);
        const targetIndex = orderedIds.indexOf(targetId);

        if (anchorIndex !== -1 && targetIndex !== -1) {
          const [start, end] =
            anchorIndex < targetIndex
              ? [anchorIndex, targetIndex]
              : [targetIndex, anchorIndex];
          const rangeIds = orderedIds.slice(start, end + 1);
          const rangeSet = new Set(rangeIds);

          if (!prev.includes(targetId)) {
            return Array.from(new Set([...prev, ...rangeIds]));
          }

          return prev.filter((selectedId) => !rangeSet.has(selectedId));
        }
      }

      return prev.includes(targetId)
        ? prev.filter((selectedId) => selectedId !== targetId)
        : [...prev, targetId];
    });

    lastInteractedIdRef.current = targetId;
  }, []);

  const togglePage = useCallback((ids: Id[]) => {
    const pageIds = (ids.filter(Boolean) as string[]).map(String);
    setSelectedIds((prev) => {
      const allSelected = pageIds.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds]));
    });
  }, []);

  const selectAll = useCallback((ids: Id[]) => {
    setSelectedIds(Array.from(new Set(ids.filter(Boolean) as string[])));
  }, []);

  const selectRange = useCallback(
    (ids: Id[], options: { additive?: boolean } = {}) => {
      const rangeIds = Array.from(new Set(ids.filter(Boolean) as string[]));
      setSelectedIds((prev) =>
        options.additive
          ? Array.from(new Set([...prev, ...rangeIds]))
          : rangeIds,
      );
    },
    [],
  );

  const clear = useCallback(() => {
    setSelectedIds([]);
    lastInteractedIdRef.current = null;
  }, []);

  const count = selectedIds.length;

  const performBulk = useCallback(
    async (
      ids: string[],
      exec: (id: string) => Promise<Response | void>,
    ): Promise<{ ok: number; fail: { id: string; error: string }[] }> => {
      const tasks = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await exec(id);
            if (res && res instanceof Response && !res.ok) {
              const j = await res.json();
              return {
                id,
                ok: false as const,
                error: j?.error || `Failed (${res.status})`,
              };
            }
            return { id, ok: true as const };
          } catch (e) {
            return { id, ok: false as const, error: (e as Error).message };
          }
        }),
      );
      const ok = tasks.filter((t) => t.ok).length;
      const fail = tasks.filter((t) => !t.ok) as {
        id: string;
        error: string;
      }[];
      return { ok, fail };
    },
    [],
  );

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      toggleOne,
      togglePage,
      selectAll,
      selectRange,
      clear,
      count,
      performBulk,
    }),
    [
      selectedIds,
      isSelected,
      toggleOne,
      togglePage,
      selectAll,
      selectRange,
      clear,
      count,
      performBulk,
    ],
  );
}
