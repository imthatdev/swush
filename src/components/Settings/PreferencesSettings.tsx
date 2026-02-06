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

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import type { UserPreferences } from "@/types/preferences";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FolderInputWithSuggestions } from "@/components/Upload/FolderInputWithSuggestions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TagInputWithSuggestions from "@/components/Common/TagInputWithSuggestions";
import ColorPicker from "@/components/Common/ColorPicker";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderMeta } from "@/types";

const DEFAULT_PREFERENCES: UserPreferences = {
  revealSpoilers: false,
  hidePreviews: false,
  vaultView: "list",
  vaultSort: "newest",
  rememberLastFolder: false,
  lastFolder: null,
  autoplayMedia: false,
  openSharedInNewTab: false,
  hidePublicShareConfirmations: false,
  publicProfileEnabled: true,
  showSocialsOnShare: false,
  socialInstagram: null,
  socialX: null,
  socialGithub: null,
  socialWebsite: null,
  socialOther: null,
  defaultUploadVisibility: "private",
  defaultUploadFolder: null,
  defaultUploadTags: [],
  defaultShortlinkVisibility: "private",
  defaultShortlinkTags: [],
  defaultShortlinkMaxClicks: null,
  defaultShortlinkExpireDays: null,
  defaultShortlinkSlugPrefix: "",
  rememberSettingsTab: true,
  lastSettingsTab: "display",
  sizeFormat: "auto",
  featureFilesEnabled: true,
  featureShortlinksEnabled: true,
  featureWatchlistEnabled: true,
};

type TagItem = { name: string; color?: string | null };

function TagCreateDialog({
  label,
  description,
  endpoint,
  onCreated,
}: {
  label: string;
  description: string;
  endpoint: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedName = normalizeTagName(name);

  const createTag = async () => {
    if (!normalizedName) {
      toast.error("Tag name is required");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(apiV1(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create tag");
      }
      toast.success("Tag created", {
        description: `#${formatTagName(normalizedName)}`,
      });
      setName("");
      setColor(null);
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error("Create failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          New tag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${endpoint}-tag-name`}>Tag name</Label>
            <Input
              id={`${endpoint}-tag-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. React"
            />
          </div>
          <ColorPicker
            id={`${endpoint}-tag-color`}
            label="Tag color"
            value={color}
            onChange={setColor}
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={createTag} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PreferencesSettings() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<UserPreferences["lastSettingsTab"]>(
    DEFAULT_PREFERENCES.lastSettingsTab,
  );
  const [uploadTagInput, setUploadTagInput] = useState("");
  const [shortlinkTagInput, setShortlinkTagInput] = useState("");
  const [uploadTags, setUploadTags] = useState<TagItem[]>([]);
  const [uploadFolders, setUploadFolders] = useState<{ name: string }[]>([]);
  useEffect(() => {
    let active = true;
    const loadFolders = async () => {
      try {
        const res = await fetch(apiV1("/folders"), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data)) setUploadFolders(data);
      } catch {}
    };
    loadFolders();
    return () => {
      active = false;
    };
  }, []);
  const [shortlinkTags, setShortlinkTags] = useState<TagItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/preferences"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load preferences");
        const data = (await res.json()) as { settings?: UserPreferences };
        if (!active) return;
        const next = { ...DEFAULT_PREFERENCES, ...(data?.settings ?? {}) };
        setPrefs(next);
        setUploadTagInput((next.defaultUploadTags ?? []).join(", "));
        setShortlinkTagInput((next.defaultShortlinkTags ?? []).join(", "));
        if (next.rememberSettingsTab) {
          setTab(next.lastSettingsTab);
        }
      } catch (err) {
        if (!active) return;
        toast.error("Could not load preferences", {
          description: (err as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const loadTags = async () => {
    const [uploadRes, shortlinkRes] = await Promise.all([
      fetch(apiV1("/tags"), { cache: "no-store" }),
      fetch(apiV1("/shortlink-tags"), { cache: "no-store" }),
    ]);

    const uploadData = uploadRes.ok
      ? ((await uploadRes.json()) as TagItem[])
      : [];
    const shortlinkData = shortlinkRes.ok
      ? ((await shortlinkRes.json()) as TagItem[])
      : [];

    setUploadTags(Array.isArray(uploadData) ? uploadData : []);
    setShortlinkTags(Array.isArray(shortlinkData) ? shortlinkData : []);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await loadTags();
      } catch {
        if (!active) return;
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const save = async (next: UserPreferences) => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      const data = (await res.json()) as { settings?: UserPreferences };
      const updated = { ...DEFAULT_PREFERENCES, ...(data?.settings ?? next) };
      setPrefs(updated);
      toast.success("Preferences saved");
    } catch (err) {
      toast.error("Failed to save preferences", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
  };

  const parseTags = (value: string, allowedTags: string[]) => {
    const allowed = new Set(
      allowedTags.map((t) => normalizeTagName(t)).filter(Boolean),
    );
    return value
      .split(",")
      .map((item) => normalizeTagName(item))
      .filter(Boolean)
      .filter((tag) => (allowed.size > 0 ? allowed.has(tag) : true));
  };

  const toTagNames = (items: TagItem[]) => items.map((item) => item.name);
  const toTagColors = (items: TagItem[]) =>
    items.reduce<Record<string, string | null>>((acc, item) => {
      const key = normalizeTagName(item.name) ?? item.name;
      acc[key] = item.color ?? null;
      return acc;
    }, {});

  const onTabChange = (value: string) => {
    const nextTab = value as UserPreferences["lastSettingsTab"];
    setTab(nextTab);
    if (prefs.rememberSettingsTab) {
      update({ lastSettingsTab: nextTab });
    }
  };

  const handleSave = () => save(prefs);

  return (
    <div className="grid gap-4">
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="grid grid-cols-3 gap-2">
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="display" className="grid gap-4">
          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Always show spoilers / NSFW</Label>
                <p className="text-xs text-muted-foreground">
                  Skip the blur overlay when previewing sensitive files.
                </p>
              </div>
              <Switch
                checked={prefs.revealSpoilers}
                onCheckedChange={(v) => update({ revealSpoilers: v })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Hide previews by default</Label>
                <p className="text-xs text-muted-foreground">
                  Show file icons instead of media previews in the vault.
                </p>
              </div>
              <Switch
                checked={prefs.hidePreviews}
                onCheckedChange={(v) => update({ hidePreviews: v })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <Label>Default vault view</Label>
            <Select
              value={prefs.vaultView}
              onValueChange={(v) =>
                update({ vaultView: v as UserPreferences["vaultView"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <Label>File size format</Label>
            <Select
              value={prefs.sizeFormat}
              onValueChange={(v) =>
                update({ sizeFormat: v as UserPreferences["sizeFormat"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="metric">KB / MB / GB</SelectItem>
                <SelectItem value="bytes">Bytes only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="grid gap-4">
          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Open shared links in a new tab</Label>
                <p className="text-xs text-muted-foreground">
                  Keep your vault open when opening public links.
                </p>
              </div>
              <Switch
                checked={prefs.openSharedInNewTab}
                onCheckedChange={(v) => update({ openSharedInNewTab: v })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Hide public share confirmations</Label>
                <p className="text-xs text-muted-foreground">
                  Skip confirmation dialogs when toggling visibility.
                </p>
              </div>
              <Switch
                checked={prefs.hidePublicShareConfirmations}
                onCheckedChange={(v) =>
                  update({ hidePublicShareConfirmations: v })
                }
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Public profile</Label>
                <p className="text-xs text-muted-foreground">
                  Allow your profile to be visible at /u/&lt;username&gt;.
                </p>
              </div>
              <Switch
                checked={prefs.publicProfileEnabled}
                onCheckedChange={(v) => update({ publicProfileEnabled: v })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Show socials on shared pages</Label>
                <p className="text-xs text-muted-foreground">
                  Let visitors discover your public social profiles.
                </p>
              </div>
              <Switch
                checked={prefs.showSocialsOnShare}
                onCheckedChange={(v) => update({ showSocialsOnShare: v })}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={prefs.socialInstagram ?? ""}
                onChange={(e) => update({ socialInstagram: e.target.value })}
                placeholder="Instagram username"
                disabled={loading || !prefs.showSocialsOnShare}
              />
              <Input
                value={prefs.socialX ?? ""}
                onChange={(e) => update({ socialX: e.target.value })}
                placeholder="X username"
                disabled={loading || !prefs.showSocialsOnShare}
              />
              <Input
                value={prefs.socialGithub ?? ""}
                onChange={(e) => update({ socialGithub: e.target.value })}
                placeholder="GitHub username"
                disabled={loading || !prefs.showSocialsOnShare}
              />
              <Input
                value={prefs.socialWebsite ?? ""}
                onChange={(e) => update({ socialWebsite: e.target.value })}
                placeholder="Website URL"
                disabled={loading || !prefs.showSocialsOnShare}
              />
              <Input
                value={prefs.socialOther ?? ""}
                onChange={(e) => update({ socialOther: e.target.value })}
                placeholder="Other link"
                disabled={loading || !prefs.showSocialsOnShare}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Remember last folder</Label>
                <p className="text-xs text-muted-foreground">
                  Return to your last opened folder in the vault.
                </p>
              </div>
              <Switch
                checked={prefs.rememberLastFolder}
                onCheckedChange={(v) => update({ rememberLastFolder: v })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Remember preferences tab</Label>
                <p className="text-xs text-muted-foreground">
                  Keep the last preferences tab selected.
                </p>
              </div>
              <Switch
                checked={prefs.rememberSettingsTab}
                onCheckedChange={(v) => update({ rememberSettingsTab: v })}
                disabled={loading}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="defaults" className="grid gap-4">
          <Tabs defaultValue="vault">
            <TabsList className="grid gap-2 grid-cols-3 h-full grid-flow-row">
              <TabsTrigger value="vault">Vault</TabsTrigger>
              <TabsTrigger value="uploads">Uploads</TabsTrigger>
              <TabsTrigger value="shortlinks">Shortlinks</TabsTrigger>
            </TabsList>

            <TabsContent value="vault" className="grid gap-4">
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default vault sort</Label>
                <Select
                  value={prefs.vaultSort}
                  onValueChange={(v) =>
                    update({ vaultSort: v as UserPreferences["vaultSort"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                    <SelectItem value="size-desc">Size (largest)</SelectItem>
                    <SelectItem value="size-asc">Size (smallest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="uploads" className="grid gap-4">
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default upload visibility</Label>
                <Select
                  value={prefs.defaultUploadVisibility}
                  onValueChange={(v) =>
                    update({
                      defaultUploadVisibility:
                        v as UserPreferences["defaultUploadVisibility"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <FolderInputWithSuggestions
                  id="default-upload-folder"
                  label="Default upload folder"
                  value={prefs.defaultUploadFolder ?? ""}
                  onChange={(v) => {
                    let folder = v.trim();
                    if (folder.length > 0) {
                      folder =
                        folder[0].toUpperCase() + folder.slice(1).toLowerCase();
                    }
                    update({ defaultUploadFolder: folder || null });
                  }}
                  focused={false}
                  setFocused={() => {}}
                  folders={uploadFolders as FolderMeta[]}
                  placeholder="Leave empty for none"
                />
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Default upload tags</Label>
                  <TagCreateDialog
                    label="Create upload tag"
                    description="Add a colored tag for file uploads."
                    endpoint="/tags"
                    onCreated={loadTags}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  To create tags, please use the dialog.
                </p>
                <TagInputWithSuggestions
                  value={uploadTagInput}
                  onChange={(value) => {
                    setUploadTagInput(value);
                    update({
                      defaultUploadTags: parseTags(
                        value,
                        toTagNames(uploadTags),
                      ),
                    });
                  }}
                  availableTags={toTagNames(uploadTags)}
                  tagColors={toTagColors(uploadTags)}
                  placeholder="Type to add tags..."
                />
              </div>
            </TabsContent>

            <TabsContent value="shortlinks" className="grid gap-4">
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default shortlink visibility</Label>
                <Select
                  value={prefs.defaultShortlinkVisibility}
                  onValueChange={(v) =>
                    update({
                      defaultShortlinkVisibility:
                        v as UserPreferences["defaultShortlinkVisibility"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Default shortlink tags</Label>
                  <TagCreateDialog
                    label="Create shortlink tag"
                    description="Add a colored tag for shortlinks."
                    endpoint="/shortlink-tags"
                    onCreated={loadTags}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  To create tags, please use the dialog.
                </p>
                <TagInputWithSuggestions
                  value={shortlinkTagInput}
                  onChange={(value) => {
                    setShortlinkTagInput(value);
                    update({
                      defaultShortlinkTags: parseTags(
                        value,
                        toTagNames(shortlinkTags),
                      ),
                    });
                  }}
                  availableTags={toTagNames(shortlinkTags)}
                  tagColors={toTagColors(shortlinkTags)}
                  placeholder="Type to add tags..."
                />
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default shortlink max clicks</Label>
                <Input
                  type="number"
                  value={prefs.defaultShortlinkMaxClicks ?? ""}
                  onChange={(e) =>
                    update({
                      defaultShortlinkMaxClicks:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="0 for unlimited"
                />
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default shortlink expiry (days)</Label>
                <Input
                  type="number"
                  value={prefs.defaultShortlinkExpireDays ?? ""}
                  onChange={(e) =>
                    update({
                      defaultShortlinkExpireDays:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Leave empty for never"
                />
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <Label>Default shortlink slug prefix</Label>
                <Input
                  value={prefs.defaultShortlinkSlugPrefix}
                  onChange={(e) =>
                    update({ defaultShortlinkSlugPrefix: e.target.value })
                  }
                  placeholder="e.g. go-"
                />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
