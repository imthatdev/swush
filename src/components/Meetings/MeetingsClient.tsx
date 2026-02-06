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
import MeetingSettings from "@/components/Settings/MeetingSettings";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationFooter } from "@/components/Shared/PaginationFooter";
import { usePagination } from "@/hooks/use-pagination";

type Booking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestEmail: string;
  guestNotes?: string | null;
  extraAttendees?: Array<{ name?: string; email?: string }>;
  meetingLocation?: string | null;
  meetingLink?: string | null;
  paymentRequired?: boolean;
  paymentReference?: string | null;
  paidAt?: string | null;
  statusMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value?: string) {
  if (!value) return "ꕀ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ꕀ";
  return date.toLocaleString();
}

function statusVariant(status: string) {
  switch (status) {
    case "accepted":
      return "default";
    case "completed":
      return "secondary";
    case "declined":
    case "cancelled":
      return "destructive";
    case "pending_payment":
      return "secondary";
    default:
      return "outline";
  }
}

export default function MeetingsClient() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({});
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>(
    {},
  );
  const { page, setPage, totalPages, paginatedItems } = usePagination(
    items,
    12,
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/meetings/host?limit=500&offset=0"), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load meetings");
      const data = (await res.json()) as { data?: Booking[] };
      setItems(data?.data ?? []);
    } catch (err) {
      toast.error("Could not load meetings", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const ids = new Set(items.map((item) => item.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (ids.has(id)) next.add(id);
      }
      return next;
    });
  }, [items]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending").length,
    [items],
  );

  const clearFromList = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(paginatedItems.map((item) => item.id)));
  };

  const clearBooking = async (id: string) => {
    setActionId(id);
    try {
      const res = await fetch(apiV1(`/meetings/host/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Clear failed");
      }
      clearFromList(id);
      toast.success("Booking cleared");
    } catch (err) {
      toast.error("Failed to clear booking", {
        description: (err as Error).message,
      });
    } finally {
      setActionId(null);
    }
  };

  const clearSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} booking${ids.length > 1 ? "s" : ""}?`,
    );
    if (!confirmed) return;
    setActionId("bulk");
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(apiV1(`/meetings/host/${id}`), { method: "DELETE" }),
        ),
      );
      const failed = results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && !result.value.ok),
      );
      if (failed.length) {
        toast.error("Some bookings failed to delete", {
          description: `${failed.length} failed`,
        });
      } else {
        toast.success("Bookings deleted");
      }
      setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error("Failed to delete bookings", {
        description: (err as Error).message,
      });
    } finally {
      setActionId(null);
    }
  };

  const bulkUpdate = async (status: "accepted" | "declined") => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = window.confirm(
      `${status === "accepted" ? "Accept" : "Decline"} ${ids.length} booking${
        ids.length > 1 ? "s" : ""
      }?`,
    );
    if (!confirmed) return;
    setActionId("bulk");
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(apiV1(`/meetings/host/${id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status,
              meetingLink: draftLinks[id] || undefined,
              message: draftMessages[id] || undefined,
            }),
          }),
        ),
      );
      const failed = results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && !result.value.ok),
      );
      if (failed.length) {
        toast.error("Some bookings failed to update", {
          description: `${failed.length} failed`,
        });
      } else {
        toast.success(`Bookings ${status}`);
      }
      const updates = new Map(ids.map((id) => [id, status] as const));
      setItems((prev) =>
        prev.map((item) => (updates.has(item.id) ? { ...item, status } : item)),
      );
      setSelectedIds(new Set());
    } catch (err) {
      toast.error("Failed to update bookings", {
        description: (err as Error).message,
      });
    } finally {
      setActionId(null);
    }
  };

  const updateBooking = async (id: string, status: string) => {
    setActionId(id);
    try {
      const res = await fetch(apiV1(`/meetings/host/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          meetingLink: draftLinks[id] || undefined,
          message: draftMessages[id] || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Update failed");
      }
      const data = (await res.json()) as {
        data?: Booking;
        emailSent?: boolean;
        emailError?: string | null;
      };
      setItems((prev) =>
        prev.map((item) => (item.id === id ? (data.data as Booking) : item)),
      );
      toast.success(`Booking ${status}`);
      if (data?.emailSent === false) {
        toast.error("Email failed to send", {
          description: data?.emailError || "SMTP configuration issue",
        });
      }
    } catch (err) {
      toast.error("Failed to update booking", {
        description: (err as Error).message,
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageLayout
      title="Meetings"
      subtitle="Review booking requests and confirm sessions."
      toolbar={
        <div className="text-xs text-muted-foreground">
          {pendingCount} pending
        </div>
      }
    >
      <Tabs defaultValue="bookings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bookings" className="gap-2">
            Bookings
            {pendingCount > 0 ? (
              <Badge variant="secondary">{pendingCount}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Checkbox
                checked={
                  paginatedItems.length > 0 &&
                  selectedIds.size === paginatedItems.length
                }
                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
              />
              <span>
                {selectedIds.size} selected · Page {page}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUpdate("accepted")}
                disabled={!selectedIds.size || actionId === "bulk"}
              >
                Accept selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUpdate("declined")}
                disabled={!selectedIds.size || actionId === "bulk"}
              >
                Decline selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={clearSelected}
                disabled={!selectedIds.size || actionId === "bulk"}
              >
                Delete selected
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading meetings...
            </div>
          ) : paginatedItems.length ? (
            paginatedItems.map((item) => {
              const resolved = ["cancelled", "declined", "completed"].includes(
                item.status,
              );
              const selected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-md border p-4 space-y-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                    selected ? "border-primary/60 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {item.guestName} · {item.guestEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(item.startsAt)} → {formatDate(item.endsAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleSelection(item.id)}
                      />
                      <Badge variant={statusVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  {item.guestNotes ? (
                    <div className="text-sm text-muted-foreground">
                      {item.guestNotes}
                    </div>
                  ) : null}

                  {item.extraAttendees?.length ? (
                    <div className="text-xs text-muted-foreground">
                      Additional attendees:{" "}
                      {item.extraAttendees
                        .map((att) => att.email || att.name)
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : null}

                  {item.paymentRequired ? (
                    <div className="text-xs text-muted-foreground">
                      Payment: {item.paidAt ? "Paid" : "Pending"}
                      {item.paymentReference ? (
                        <> · Ref: {item.paymentReference}</>
                      ) : null}
                      {item.paidAt ? <> · {formatDate(item.paidAt)}</> : null}
                    </div>
                  ) : null}

                  {!resolved ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        placeholder="Meeting link (optional)"
                        value={draftLinks[item.id] ?? item.meetingLink ?? ""}
                        onChange={(e) =>
                          setDraftLinks((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                      <Textarea
                        placeholder="Message to guest (optional)"
                        value={
                          draftMessages[item.id] ?? item.statusMessage ?? ""
                        }
                        onChange={(e) =>
                          setDraftMessages((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {item.status === "pending" ||
                    item.status === "pending_payment" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateBooking(item.id, "accepted")}
                          disabled={actionId === item.id}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBooking(item.id, "declined")}
                          disabled={actionId === item.id}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {item.status === "accepted" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateBooking(item.id, "completed")}
                          disabled={actionId === item.id}
                        >
                          Mark completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBooking(item.id, "cancelled")}
                          disabled={actionId === item.id}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                    {resolved ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearBooking(item.id)}
                        disabled={actionId === item.id}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">
              No bookings yet.
            </div>
          )}
          <PaginationFooter
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Meeting settings</h2>
            <p className="text-xs text-muted-foreground">
              Configure availability, payments, and acceptance rules.
            </p>
          </div>
          <MeetingSettings />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
