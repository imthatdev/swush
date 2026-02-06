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
import { useSearchParams } from "next/navigation";
import PageLayout from "@/components/Common/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CopyButton from "@/components/Common/CopyButton";
import { apiV1 } from "@/lib/api-path";
import { shareUrl } from "@/lib/api/helpers";
import { IconShare, IconTrash } from "@tabler/icons-react";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { toast } from "sonner";

type UploadLink = {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  isActive: boolean;
  expiresAt?: string | null;
  folderName?: string | null;
  brandColor?: string | null;
  brandLogoUrl?: string | null;
  maxUploads?: number | null;
  uploadsCount?: number | null;
  viewsCount?: number | null;
  requiresApproval?: boolean;
  passwordEnabled?: boolean;
  pendingCount?: number | null;
  perUserUploadLimit?: number | null;
  perUserWindowHours?: number | null;
  createdAt?: string | null;
};

export default function UploadLinksClient() {
  const [items, setItems] = useState<UploadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderName, setFolderName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [brandColor, setBrandColor] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [maxUploads, setMaxUploads] = useState<number | "">("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [password, setPassword] = useState("");
  const [perUserUploadLimit, setPerUserUploadLimit] = useState<number | "">("");
  const [perUserWindowHours, setPerUserWindowHours] = useState<number | "">(24);
  const [query, setQuery] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<
    {
      id: string;
      status: string;
      createdAt?: string | null;
      decidedAt?: string | null;
      fileId?: string | null;
      fileSlug?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
    }[]
  >([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueTarget, setQueueTarget] = useState<UploadLink | null>(null);
  const [queueHandled, setQueueHandled] = useState(false);
  const searchParams = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/upload-requests"), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load upload links");
      const json = (await res.json()) as { data?: UploadLink[] };
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      toast.error("Unable to load upload links", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      return (
        row.title.toLowerCase().includes(q) ||
        (row.description || "").toLowerCase().includes(q) ||
        (row.folderName || "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFolderName("");
    setExpiresAt("");
    setIsActive(true);
    setBrandColor("");
    setBrandLogoUrl("");
    setMaxUploads("");
    setRequiresApproval(false);
    setPassword("");
    setPerUserUploadLimit("");
    setPerUserWindowHours(24);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(apiV1("/upload-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          folderName: folderName.trim() || null,
          brandColor: brandColor.trim() || null,
          brandLogoUrl: brandLogoUrl.trim() || null,
          maxUploads: maxUploads === "" ? null : Number(maxUploads),
          requiresApproval,
          password: password.trim() || null,
          perUserUploadLimit:
            perUserUploadLimit === "" ? null : Number(perUserUploadLimit),
          perUserWindowHours:
            perUserWindowHours === "" ? null : Number(perUserWindowHours),
          expiresAt: expiresAt || null,
          isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to create");
      toast.success("Upload link created");
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Unable to create link", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, next: boolean) => {
    const prev = items;
    setItems((cur) =>
      cur.map((item) => (item.id === id ? { ...item, isActive: next } : item)),
    );
    try {
      const res = await fetch(apiV1(`/upload-requests/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (err) {
      setItems(prev);
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(apiV1(`/upload-requests/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((cur) => cur.filter((item) => item.id !== id));
      toast.success("Upload link removed");
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const openQueue = async (link: UploadLink) => {
    setQueueTarget(link);
    setQueueOpen(true);
    setQueueLoading(true);
    try {
      const res = await fetch(apiV1(`/upload-requests/${link.id}/queue`), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load queue");
      const json = (await res.json()) as { items?: typeof queueItems };
      setQueueItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      toast.error("Unable to load queue", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const openQueueById = async (id: string) => {
    const link = items.find((item) => item.id === id);
    await openQueue(
      link ?? {
        id,
        title: "Upload link",
        slug: "",
        isActive: true,
      },
    );
  };

  useEffect(() => {
    if (queueHandled) return;
    const id = searchParams.get("queue");
    if (!id) return;
    setQueueHandled(true);
    void openQueueById(id);
  }, [queueHandled, searchParams, items]);

  const handleQueueAction = async (
    itemId: string,
    action: "approve" | "reject",
  ) => {
    if (!queueTarget) return;
    try {
      const res = await fetch(
        apiV1(`/upload-requests/${queueTarget.id}/queue/${itemId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) throw new Error("Action failed");
      setQueueItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, status: action } : item,
        ),
      );
    } catch (err) {
      toast.error("Queue update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <PageLayout
      title="Upload Links"
      subtitle="Create guest upload links that drop into your vault"
      headerActions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Upload Link</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create upload link</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 overflow-y-auto max-h-130">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Target folder (optional)"
              />
              <Input
                value={maxUploads === "" ? "" : String(maxUploads)}
                onChange={(e) => {
                  const value = e.target.value;
                  setMaxUploads(value === "" ? "" : Number(value));
                }}
                type="number"
                min={0}
                placeholder="Max uploads (0 = unlimited)"
              />
              <Input
                value={
                  perUserUploadLimit === "" ? "" : String(perUserUploadLimit)
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setPerUserUploadLimit(value === "" ? "" : Number(value));
                }}
                type="number"
                min={0}
                placeholder="Per-user limit (0 = unlimited)"
              />
              <Input
                value={
                  perUserWindowHours === "" ? "" : String(perUserWindowHours)
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setPerUserWindowHours(value === "" ? "" : Number(value));
                }}
                type="number"
                min={1}
                placeholder="Per-user window hours (default 24)"
              />
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Approval required</div>
                  <div className="text-xs text-muted-foreground">
                    New uploads must be approved.
                  </div>
                </div>
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (optional)"
              />
              <Input
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                placeholder="Brand logo URL (optional)"
              />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Brand color</div>
                <Input
                  type="color"
                  value={brandColor || "#3b82f6"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  aria-label="Brand color"
                />
              </div>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                placeholder="Expires at (optional)"
              />
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Active link</div>
                  <div className="text-xs text-muted-foreground">
                    Turn off to disable uploads.
                  </div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
      toolbar={
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search upload links"
          className="w-full"
        />
      }
    >
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No upload links yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => {
            const shareLink = shareUrl("up", row.slug);
            return (
              <Card key={row.id}>
                <CardHeader className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm">{row.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.isActive ? "default" : "secondary"}>
                        {row.isActive ? "Active" : "Disabled"}
                      </Badge>
                      {row.folderName ? (
                        <Badge variant="outline">{row.folderName}</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {row.description ? (
                    <p className="text-muted-foreground line-clamp-2">
                      {row.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton
                      variant="outline"
                      size="sm"
                      successMessage="Copied upload link"
                      getText={() => shareLink}
                    >
                      <IconShare className="h-4 w-4" />
                      <span>Copy link</span>
                    </CopyButton>
                    <ShareQrButton url={shareLink} />
                    {row.requiresApproval && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openQueue(row)}
                      >
                        Review queue
                      </Button>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Active
                      </span>
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(v) => handleToggle(row.id, v)}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                    >
                      <IconTrash className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2 py-0.5">
                      Views:{" "}
                      <span className="font-medium">{row.viewsCount ?? 0}</span>
                    </span>
                    <span className="rounded-full border px-2 py-0.5">
                      Uploads:{" "}
                      <span className="font-medium">
                        {row.uploadsCount ?? 0}
                      </span>
                      {row.maxUploads ? ` / ${row.maxUploads}` : ""}
                    </span>
                    {row.pendingCount ? (
                      <span className="rounded-full border px-2 py-0.5">
                        Pending:{" "}
                        <span className="font-medium">{row.pendingCount}</span>
                      </span>
                    ) : null}
                    {row.perUserUploadLimit ? (
                      <span className="rounded-full border px-2 py-0.5">
                        Per-user: {row.perUserUploadLimit}/
                        {row.perUserWindowHours ?? 24}h
                      </span>
                    ) : null}
                    {row.requiresApproval ? (
                      <span className="rounded-full border px-2 py-0.5">
                        Approval
                      </span>
                    ) : null}
                    {row.passwordEnabled ? (
                      <span className="rounded-full border px-2 py-0.5">
                        Password
                      </span>
                    ) : null}
                  </div>
                  {row.expiresAt ? (
                    <div className="text-xs text-muted-foreground">
                      Expires {new Date(row.expiresAt).toLocaleString()}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {queueTarget
                ? `Review queue · ${queueTarget.title}`
                : "Review queue"}
            </DialogTitle>
          </DialogHeader>
          {queueLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : queueItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {item.fileName || "(file removed)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.fileSize
                        ? `${Math.round(item.fileSize / 1024)} KB`
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.status}</Badge>
                    {item.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleQueueAction(item.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleQueueAction(item.id, "reject")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
