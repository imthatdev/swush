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
import { toast } from "sonner";
import { apiV1, apiV1Path } from "@/lib/api-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEBHOOK_EVENTS = [
  { id: "file.uploaded", label: "File uploaded" },
  { id: "file.deleted", label: "File deleted" },
  { id: "shortlink.created", label: "Short link created" },
  { id: "bookmark.created", label: "Bookmark created" },
  { id: "note.created", label: "Note created" },
];

type WebhookRow = {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  format?: "json" | "discord";
  events: string[] | null;
  enabled: boolean;
  lastStatus?: number | null;
  lastError?: string | null;
  lastDeliveredAt?: string | null;
};

export function Integrations() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set(["file.uploaded"]));
  const [format, setFormat] = useState<"json" | "discord">("json");
  const [creating, setCreating] = useState(false);

  const eventLabels = useMemo(() => {
    return WEBHOOK_EVENTS.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.label;
      return acc;
    }, {});
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/integrations/webhooks"), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load webhooks");
      const data = (await res.json()) as { webhooks: WebhookRow[] };
      setWebhooks(data.webhooks ?? []);
    } catch (err) {
      toast.error("Failed to load webhooks", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const toggleEvent = (id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("file.uploaded");
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(apiV1("/integrations/webhooks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          secret: secret.trim() || null,
          events: Array.from(events),
          format,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create webhook");
      toast.success("Webhook created");
      setDialogOpen(false);
      setName("");
      setUrl("");
      setSecret("");
      setEvents(new Set(["file.uploaded"]));
      setFormat("json");
      await fetchWebhooks();
    } catch (err) {
      toast.error("Failed to create webhook", {
        description: (err as Error).message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(apiV1Path("/integrations/webhooks", id), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook deleted");
    } catch (err) {
      toast.error("Failed to delete webhook", {
        description: (err as Error).message,
      });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(apiV1Path("/integrations/webhooks", id, "test"), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Test failed");
      toast.success("Test sent");
      await fetchWebhooks();
    } catch (err) {
      toast.error("Test failed", {
        description: (err as Error).message,
      });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(apiV1Path("/integrations/webhooks", id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, enabled } : w)),
      );
    } catch (err) {
      toast.error("Failed to update webhook", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Create webhooks for uploads and links.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="https://example.com/webhooks/swush"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Input
                placeholder="Secret (optional)"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <div className="grid gap-2">
                <div className="text-sm font-medium">Events</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <label
                      key={evt.id}
                      className="flex items-start gap-2 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        checked={events.has(evt.id)}
                        onCheckedChange={() => toggleEvent(evt.id)}
                      />
                      <span className="text-sm">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">Format</div>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as "json" | "discord")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON (generic)</SelectItem>
                    <SelectItem value="discord">Discord webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-2 px-3 text-left">Name</TableHead>
              <TableHead className="py-2 px-3 text-left">Events</TableHead>
              <TableHead className="py-2 px-3 text-left">Status</TableHead>
              <TableHead className="py-2 px-3 text-left">Enabled</TableHead>
              <TableHead className="py-2 px-3 text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableCaption className="py-4 text-center text-muted-foreground">
              Loading webhooks...
            </TableCaption>
          ) : webhooks.length === 0 ? (
            <TableCaption className="py-4 text-center text-muted-foreground">
              No webhooks yet
            </TableCaption>
          ) : (
            <TableBody>
              {webhooks.map((hook) => (
                <TableRow key={hook.id}>
                  <TableCell className="py-2 px-3 font-medium">
                    <div>{hook.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {hook.url}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {(hook.events || []).map((evt) => (
                        <Badge key={evt} variant="outline" className="text-xs">
                          {eventLabels[evt] || evt}
                        </Badge>
                      ))}
                    </div>
                    {hook.format === "discord" ? (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">
                          Discord
                        </Badge>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {hook.lastStatus ? (
                      <span className="text-xs text-muted-foreground">
                        {hook.lastStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                    {hook.lastError ? (
                      <div className="text-xs text-destructive">
                        {hook.lastError}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Switch
                      checked={hook.enabled}
                      onCheckedChange={(v) => handleToggle(hook.id, v)}
                    />
                  </TableCell>
                  <TableCell className="py-2 px-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(hook.id)}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(hook.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>
    </section>
  );
}
