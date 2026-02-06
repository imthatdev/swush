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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiV1 } from "@/lib/api-path";
import { cn } from "@/lib/utils";
import Link from "next/link";

type NotificationItem = {
  id: string;
  title: string;
  message?: string | null;
  type: string;
  createdAt: string | Date;
  readAt?: string | Date | null;
  data?: Record<string, unknown> | null;
};

type NotificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadChange?: (count: number) => void;
};

export default function NotificationBell({
  open,
  onOpenChange,
  onUnreadChange,
}: NotificationDialogProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/notifications?limit=8"), {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      const unreadCount = Number(json.unread || 0);
      setUnread(unreadCount);
      onUnreadChange?.(unreadCount);
      return { unread: unreadCount };
    } finally {
      setLoading(false);
    }
    return { unread: 0 };
  }, [onUnreadChange]);

  const markRead = useCallback(
    async (id: string) => {
      if (!id || marking) return;
      setMarking(id);
      try {
        const res = await fetch(apiV1("/notifications"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id] }),
        });
        if (!res.ok) return;
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, readAt: item.readAt ?? new Date() }
              : item,
          ),
        );
        setUnread((prev) => {
          const next = Math.max(0, prev - 1);
          onUnreadChange?.(next);
          return next;
        });
      } finally {
        setMarking(null);
      }
    },
    [marking, onUnreadChange],
  );

  const markAllRead = useCallback(
    async (count?: number) => {
      const nextUnread = typeof count === "number" ? count : unread;
      if (nextUnread === 0) return;
      await fetch(apiV1("/notifications"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setUnread(0);
      onUnreadChange?.(0);
      setItems((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date() })),
      );
    },
    [unread, onUnreadChange],
  );

  const clearAll = useCallback(async () => {
    await fetch(apiV1("/notifications"), { method: "DELETE" });
    setItems([]);
    setUnread(0);
    onUnreadChange?.(0);
  }, [onUnreadChange]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open, loadNotifications]);

  const formattedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        createdLabel: new Date(item.createdAt).toLocaleString(),
        isUnread: !item.readAt,
        uploadRequestId:
          typeof item.data?.uploadRequestId === "string"
            ? item.data.uploadRequestId
            : null,
      })),
    [items],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            Notifications
            <Badge
              variant="secondary"
              className={cn("mr-7", unread === 0 && "opacity-60")}
            >
              {unread} unread
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : formattedItems.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <div className="divide-y">
              {formattedItems.map((item) => (
                <div key={item.id} className="text-sm py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {item.isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        <span className="font-medium">{item.title}</span>
                      </div>
                      {item.message && (
                        <p className="text-xs text-muted-foreground">
                          {item.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.type === "upload-request" &&
                      item.uploadRequestId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          asChild
                        >
                          <Link
                            href={`/upload-links?queue=${item.uploadRequestId}`}
                          >
                            Check requests
                          </Link>
                        </Button>
                      ) : null}
                      {item.isUnread ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => void markRead(item.id)}
                          disabled={marking === item.id}
                        >
                          {marking === item.id ? "Saving..." : "Mark read"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {item.createdLabel}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Separator />
        <DialogFooter className="flex flex-wrap gap-2 w-full">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void markAllRead()}
            disabled={unread === 0}
          >
            Mark all read
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => void clearAll()}
            disabled={items.length === 0}
          >
            Clear notifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
