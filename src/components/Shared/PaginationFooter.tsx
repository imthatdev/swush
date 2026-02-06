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

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationFooter({
  page,
  totalPages,
  onPageChange,
}: PaginationFooterProps) {
  if (totalPages <= 1) return null;

  const MAX_BUTTONS = 7;
  const NEIGHBORS = 1;

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  function buildPages(current: number, total: number) {
    const pages: (number | "ellipsis")[] = [];
    const first = 1;
    const last = total;

    pages.push(first);

    const start = clamp(
      current - NEIGHBORS,
      first + 1,
      Math.max(first + 1, last - 2 * NEIGHBORS - 1)
    );
    const end = clamp(
      current + NEIGHBORS,
      Math.min(first + 2 * NEIGHBORS + 1, last - 1),
      last - 1
    );

    if (start > first + 1) pages.push("ellipsis");

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < last - 1) pages.push("ellipsis");

    if (last !== first) pages.push(last);

    if (total <= MAX_BUTTONS) {
      const all: (number | "ellipsis")[] = [];
      for (let i = 1; i <= total; i++) all.push(i);
      return all;
    }

    return pages;
  }

  const visible = buildPages(page, totalPages);

  return (
    <Pagination className="mt-3 max-w-xs md:max-w-screen">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page > 1) onPageChange(page - 1);
            }}
          />
        </PaginationItem>

        {visible.map((p, idx) => (
          <PaginationItem key={`${p}-${idx}`}>
            {p === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={page === p}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(p as number);
                }}
              >
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page < totalPages) onPageChange(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
