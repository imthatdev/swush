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

import { useEffect, useRef, useState } from "react";

type CacheEntry<T, Extra> = {
  items: T[];
  total: number;
  extra?: Extra;
  ts: number;
};

type FetchResult<T, Extra> = {
  items: T[];
  total: number;
  extra?: Extra;
} | null;

type UseCachedPagedListOptions<T, Extra> = {
  cacheKey: string;
  page: number;
  pageSize: number;
  reloadTick: number;
  cacheMs?: number;
  setPage?: (page: number) => void;
  setReloadTick?: (tick: number) => void;
  setLoading?: (loading: boolean) => void;
  onExtra?: (extra: Extra) => void;
  fetcher: () => Promise<FetchResult<T, Extra>>;
};

export function useCachedPagedList<T, Extra = undefined>(
  options: UseCachedPagedListOptions<T, Extra>,
) {
  const {
    cacheKey,
    page,
    pageSize,
    reloadTick,
    cacheMs = 30_000,
    setPage,
    setReloadTick,
    setLoading,
    onExtra,
    fetcher,
  } = options;
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const cacheRef = useRef(new Map<string, CacheEntry<T, Extra>>());

  useEffect(() => {
    let cancelled = false;
    const forceReload = reloadTick > 0;
    const cached = forceReload ? undefined : cacheRef.current.get(cacheKey);

    if (cached) {
      setItems(cached.items);
      setTotalCount(cached.total);
      const nextTotalPages = Math.max(1, Math.ceil(cached.total / pageSize));
      setTotalPages(nextTotalPages);
      if (cached.extra !== undefined && onExtra) {
        onExtra(cached.extra);
      }
      setListLoading(false);
      if (Date.now() - cached.ts < cacheMs) {
        return () => {
          cancelled = true;
        };
      }
    }

    (async () => {
      if (!cached) setListLoading(true);
      try {
        const result = await fetcher();
        if (cancelled || !result) return;
        const { items: nextItems, total, extra } = result;
        setItems(nextItems);
        setTotalCount(total);
        const nextTotalPages = Math.max(1, Math.ceil(total / pageSize));
        setTotalPages(nextTotalPages);
        if (setPage && page > nextTotalPages) setPage(nextTotalPages);
        if (extra !== undefined && onExtra) onExtra(extra);
        cacheRef.current.set(cacheKey, {
          items: nextItems,
          total,
          extra,
          ts: Date.now(),
        });
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setListLoading(false);
        if (forceReload && setReloadTick) setReloadTick(0);
        if (forceReload && setLoading) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    page,
    pageSize,
    reloadTick,
    cacheMs,
    setPage,
    setReloadTick,
    setLoading,
    onExtra,
    fetcher,
  ]);

  const clearCache = () => {
    cacheRef.current.clear();
  };

  return {
    items,
    setItems,
    totalCount,
    setTotalCount,
    totalPages,
    setTotalPages,
    listLoading,
    setListLoading,
    clearCache,
  };
}
