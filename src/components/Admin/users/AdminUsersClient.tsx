/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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
  IconTrash,
  IconFlameFilled,
  IconBan,
  IconRefresh,
  IconUserCheck,
  IconHammer,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import PageLayout from "../../Common/PageLayout";
import { PaginationFooter } from "../../Shared/PaginationFooter";
import { randomPassword } from "@/lib/api/helpers";
import { copyToClipboard } from "@/lib/client/clipboard";
import {
  adminBanUser,
  adminClearUser,
  adminCreateUser,
  adminDisableUser2FA,
  adminListUsers,
  adminRemoveUser,
  adminSetRole,
  adminSetVerified,
  adminUnbanUser,
  adminUpdateUserLimits,
} from "@/lib/client/admin";
import type { AdminUser } from "@/types/admin";
import { CreateUserDialog, type CreateUserForm } from "./CreateUserDialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

function hasCustomLimits(u: AdminUser) {
  return (
    u.maxStorageMb != null ||
    u.maxUploadMb != null ||
    u.filesLimit != null ||
    u.shortLinksLimit != null ||
    u.allowRemoteUpload != null ||
    u.disableApiTokens ||
    u.allowFiles != null ||
    u.allowShortlinks != null ||
    u.allowWatchlist != null
  );
}

function normLimit(v: number | null | undefined): number | null {
  return v === 0 || v == null ? null : v;
}

function normalizeUser(u: AdminUser): AdminUser {
  const safeUsage = u.usage ?? {
    files: 0,
    storageBytes: 0,
    links: 0,
    clicks: 0,
    notes: 0,
    bookmarks: 0,
    snippets: 0,
    recipes: 0,
    allowRemoteUpload: null,
  };

  return {
    ...u,
    maxStorageMb: normLimit(u.maxStorageMb),
    maxUploadMb: normLimit(u.maxUploadMb),
    filesLimit: normLimit(u.filesLimit),
    shortLinksLimit: normLimit(u.shortLinksLimit),
    allowRemoteUpload:
      u.allowRemoteUpload == null ? null : Boolean(u.allowRemoteUpload),
    disableApiTokens: Boolean(u.disableApiTokens),
    allowFiles: u.allowFiles == null ? null : Boolean(u.allowFiles),
    allowShortlinks:
      u.allowShortlinks == null ? null : Boolean(u.allowShortlinks),
    allowWatchlist: u.allowWatchlist == null ? null : Boolean(u.allowWatchlist),
    usage: safeUsage,
  };
}

export default function AdminUsersClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banBusyId, setBanBusyId] = useState<string | null>(null);
  const [verifiedBusyId, setVerifiedBusyId] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    username: "",
    password: "",
    role: "user",
  });

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<AdminUser | null>(null);
  const [clearOpts, setClearOpts] = useState({
    filesMode: "none" as "none" | "all" | "exceptFavorites",
    links: false,
    apiTokens: false,
  });

  const [disable2faBusyId, setDisable2faBusyId] = useState<string | null>(null);
  const [confirmDisable2faOpen, setConfirmDisable2faOpen] = useState(false);
  const [disable2faTarget, setDisable2faTarget] = useState<AdminUser | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [limitsTarget, setLimitsTarget] = useState<AdminUser | null>(null);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [clearSaving, setClearSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<null | "ban" | "unban" | "delete">(
    null,
  );
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [limitsForm, setLimitsForm] = useState({
    maxStorageMb: "",
    maxUploadMb: "",
    filesLimit: "",
    shortLinksLimit: "",
    allowRemoteUpload: "",
    disableApiTokens: "false",
    allowFiles: "",
    allowShortlinks: "",
    allowWatchlist: "",
  });
  const PAGE_SIZE_OPTIONS = [5, 15, 30, 60] as const;
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"login" | "registered" | "name">(
    "registered",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function prefillFromUser(u: AdminUser) {
    setLimitsForm({
      maxStorageMb: u.maxStorageMb == null ? "" : String(u.maxStorageMb),
      maxUploadMb: u.maxUploadMb == null ? "" : String(u.maxUploadMb),
      filesLimit: u.filesLimit == null ? "" : String(u.filesLimit),
      shortLinksLimit:
        u.shortLinksLimit == null ? "" : String(u.shortLinksLimit),
      allowRemoteUpload:
        u.allowRemoteUpload == null ? "" : String(u.allowRemoteUpload),
      disableApiTokens: u.disableApiTokens ? "true" : "false",
      allowFiles: u.allowFiles == null ? "" : String(u.allowFiles),
      allowShortlinks:
        u.allowShortlinks == null ? "" : String(u.allowShortlinks),
      allowWatchlist: u.allowWatchlist == null ? "" : String(u.allowWatchlist),
    });
  }

  async function openLimitsDialog(u: AdminUser) {
    setLimitsTarget(u);
    prefillFromUser(u);
    setLimitsDialogOpen(true);
  }

  async function saveLimits() {
    if (!limitsTarget) return;
    if (limitsSaving) return;
    setLimitsSaving(true);
    try {
      const body: Record<string, number | boolean | null> = {};
      const parse = (f: string, v: string) => {
        const t = v.trim();
        if (
          f === "allowRemoteUpload" ||
          f === "allowFiles" ||
          f === "allowShortlinks" ||
          f === "allowWatchlist" ||
          f === "disableApiTokens"
        ) {
          if (t === "default" || t === "") return null;
          if (t === "true" || t === "1") return true;
          if (t === "false" || t === "0") return false;
          return null;
        }
        if (t === "") return null;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      const fields: (keyof typeof limitsForm)[] = [
        "maxStorageMb",
        "maxUploadMb",
        "filesLimit",
        "shortLinksLimit",
        "allowRemoteUpload",
        "disableApiTokens",
        "allowFiles",
        "allowShortlinks",
        "allowWatchlist",
      ];
      for (const f of fields) body[f] = parse(f, limitsForm[f]);

      const res = await adminUpdateUserLimits({
        userId: limitsTarget.id,
        data: body,
      });
      if (!res.ok) {
        const msg =
          typeof res.error === "string" ? res.error : "Failed to save limits";
        toast.error(msg);
        return;
      }

      setUsers((prev) =>
        prev.map((x) =>
          x.id === limitsTarget.id ? normalizeUser({ ...x, ...body }) : x,
        ),
      );

      toast.success("Limits saved");
      setLimitsDialogOpen(false);
      setLimitsTarget(null);
    } catch (e) {
      toast.error(`Action failed: ${String(e)}`);
    } finally {
      setLimitsSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function allSelectedOnPage(list: AdminUser[]) {
    if (list.length === 0) return false;
    return list.every((u) => selectedIds.has(u.id));
  }
  function toggleAllOnPage(list: AdminUser[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = list.every((u) => next.has(u.id));
      if (all) list.forEach((u) => next.delete(u.id));
      else list.forEach((u) => next.add(u.id));
      return next;
    });
  }

  async function createUser() {
    if (creatingUser) return;
    setCreatingUser(true);
    try {
      const payload = {
        email: createForm.email.trim(),
        name: createForm.username.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
      };

      if (!payload.email || !payload.username || !payload.password) {
        toast.error("Email, username, and password are required");
        return;
      }

      const response = await adminCreateUser({ user: payload });

      if (!response.ok) {
        toast.error(response.error || "Failed to create user");
        return;
      }

      setCreateDialogOpen(false);
      setCreateForm({ email: "", username: "", password: "", role: "user" });
      toast.success("User created");
      void fetchUsers();
    } finally {
      setCreatingUser(false);
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminListUsers({
        query: {
          searchValue: debouncedQuery.trim() || undefined,
          searchField: "all",
          limit: pageSize,
          offset: (page - 1) * pageSize,
          sortBy:
            sortKey === "login"
              ? "lastLoginAt"
              : sortKey === "name"
                ? "name"
                : "createdAt",
          sortDirection: sortDir,
        },
      });
      const data = response.users.map(normalizeUser);
      setUsers(data);
      setTotalUsers(response.total ?? data.length);
    } catch (e) {
      setUsers([]);
      toast.error(`Failed to load users: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, pageSize, sortDir, sortKey]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortKey, sortDir, debouncedQuery]);

  async function banUser(u: AdminUser, ban: boolean, reason?: string) {
    setBanBusyId(u.id);
    try {
      const res = ban
        ? await adminBanUser({ userId: u.id, reason })
        : await adminUnbanUser({ userId: u.id });
      if (!res.ok) {
        toast.error(res.error || "Failed to update user");
        return;
      }
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                isBanned: ban,
                banReason: ban ? (reason ?? null) : null,
              }
            : x,
        ),
      );
      toast.success(ban ? "User banned" : "User unbanned");
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
    } catch {
      toast.error("Action failed");
    } finally {
      setBanBusyId(null);
    }
  }

  async function changeRole(u: AdminUser, role: "owner" | "admin" | "user") {
    if (roleBusyId) return;
    setRoleBusyId(u.id);
    try {
      const res = await adminSetRole({ userId: u.id, role });
      if (!res.ok) throw new Error(res.error || "Unknown error");

      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast.success(`Role changed to ${role}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      toast.error(msg);
    } finally {
      setRoleBusyId(null);
    }
  }

  async function toggleVerified(u: AdminUser, verified: boolean) {
    setVerifiedBusyId(u.id);
    const res = await adminSetVerified({ userId: u.id, verified });
    if (!res.ok) {
      toast.error(res.error || "Failed to update verified status");
      setVerifiedBusyId(null);
      return;
    }
    setUsers((prev) =>
      prev.map((item) => (item.id === u.id ? { ...item, verified } : item)),
    );
    setVerifiedBusyId(null);
  }

  async function deleteUser(id: string) {
    setDeleteBusyId(id);
    try {
      const res = await adminRemoveUser({ userId: id });
      if (!res.ok) {
        toast.error(res.error || "Failed to delete");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotalUsers((v) => Math.max(0, v - 1));
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function bulkBan(ban: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(ban ? "ban" : "unban");
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = ban
            ? await adminBanUser({ userId: id })
            : await adminUnbanUser({ userId: id });
          return { id, ok: res.ok };
        }),
      );
      const okIds = results
        .filter(
          (r): r is PromiseFulfilledResult<{ id: string; ok: boolean }> =>
            r.status === "fulfilled" && r.value.ok,
        )
        .map((r) => r.value.id);
      if (okIds.length) {
        setUsers((prev) =>
          prev.map((u) =>
            okIds.includes(u.id)
              ? {
                  ...u,
                  isBanned: ban,
                  banReason: ban ? (u.banReason ?? null) : null,
                }
              : u,
          ),
        );
        toast.success(
          `${ban ? "Banned" : "Unbanned"} ${okIds.length} user${
            okIds.length > 1 ? "s" : ""
          }`,
        );
      }
      clearSelection();
    } finally {
      setBulkBusy(null);
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    setBulkBusy("delete");
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await adminRemoveUser({ userId: id });
          return { id, ok: res.ok };
        }),
      );
      const okIds = results
        .filter(
          (r): r is PromiseFulfilledResult<{ id: string; ok: boolean }> =>
            r.status === "fulfilled" && r.value.ok,
        )
        .map((r) => r.value.id);
      if (okIds.length) {
        setUsers((prev) => prev.filter((u) => !okIds.includes(u.id)));
        setTotalUsers((v) => Math.max(0, v - okIds.length));
        toast.success(
          `Deleted ${okIds.length} user${okIds.length > 1 ? "s" : ""}`,
        );
      }
      clearSelection();
      setConfirmDeleteOpen(false);
    } finally {
      setBulkBusy(null);
    }
  }

  async function clearUserData() {
    if (!clearTarget) return;
    if (clearSaving) return;
    setClearSaving(true);
    const options: Record<string, unknown> = {
      links: clearOpts.links,
      apiTokens: clearOpts.apiTokens,
    };
    if (clearOpts.filesMode === "all") options.filesAll = true;
    if (clearOpts.filesMode === "exceptFavorites")
      options.filesExceptFavorites = true;

    const res = await adminClearUser({ userId: clearTarget.id, options });
    if (!res.ok) {
      toast.error(
        typeof res.error === "string" ? res.error : "Failed to clear data",
      );
      setClearSaving(false);
      return;
    }
    toast.success("Data cleared");
    setClearDialogOpen(false);
    setClearTarget(null);
    void fetchUsers();
    setClearSaving(false);
  }

  async function disable2fa(u: AdminUser) {
    try {
      setDisable2faBusyId(u.id);
      const res = await adminDisableUser2FA({ userId: u.id });
      if (!res.ok) {
        const msg =
          typeof res.error === "string" ? res.error : "Failed to disable 2FA";
        toast.error(msg);
        return;
      }
      toast.success("2FA disabled for user");
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, twoFactor: false } : x)),
      );
    } catch (e) {
      toast.error(`Action failed: ${String(e)}`);
    } finally {
      setDisable2faBusyId(null);
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }

  async function handleGeneratePassword() {
    const pwd = randomPassword(16);
    setCreateForm((f) => ({ ...f, password: pwd }));
    try {
      await copyToClipboard(pwd);
      toast.success("Password generated & copied");
    } catch {
      toast.success("Password generated");
    }
  }

  const totalPages = useMemo(() => {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(totalUsers / pageSize));
  }, [pageSize, totalUsers]);

  return (
    <PageLayout
      title="Manage Users"
      subtitle="Manage members, ban accounts, and review usage."
      toolbar={
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="rounded-md border text-sm px-2 min-w-30">
              <SelectValue placeholder="Select page size" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} items
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortKey}
            onValueChange={(v) =>
              setSortKey(v as "login" | "registered" | "name")
            }
          >
            <SelectTrigger className="rounded-md border text-sm px-2 min-w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registered">Registration date</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortDir}
            onValueChange={(v) => setSortDir(v as "desc" | "asc")}
          >
            <SelectTrigger className="rounded-md border text-sm px-2 min-w-30">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Desc</SelectItem>
              <SelectItem value="asc">Asc</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void handleRefresh()}
            className="gap-2"
            disabled={refreshing || loading}
          >
            <IconRefresh
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />{" "}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <CreateUserDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            form={createForm}
            onFormChange={setCreateForm}
            onCreate={() => void createUser()}
            onGeneratePassword={handleGeneratePassword}
            creating={creatingUser}
          />
        </>
      }
    >
      <Card>
        <CardContent className="px-2 overflow-x-auto">
          {selectedIds.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
              <span>
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => toggleAllOnPage(users)}
                  disabled={users.length === 0}
                  size="sm"
                >
                  Select Page ({users.length})
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void bulkBan(true)}
                  disabled={bulkBusy !== null}
                >
                  <IconBan className="h-4 w-4" />{" "}
                  {bulkBusy === "ban" ? "Banning…" : "Ban Selected"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void bulkBan(false)}
                  disabled={bulkBusy !== null}
                >
                  <IconUserCheck className="h-4 w-4" />{" "}
                  {bulkBusy === "unban" ? "Unbanning…" : "Unban Selected"}
                </Button>
                <Dialog
                  open={confirmDeleteOpen}
                  onOpenChange={setConfirmDeleteOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={bulkBusy !== null}
                    >
                      <IconTrash className="h-4 w-4" /> Remove Selected
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Delete {selectedIds.size} selected user
                        {selectedIds.size === 1 ? "" : "s"}?
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        This action cannot be undone.
                      </p>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          setConfirmDeleteOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => void bulkDelete()}
                        disabled={bulkBusy === "delete"}
                      >
                        {bulkBusy === "delete" ? "Deleting…" : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
          <Table className="w-full text-sm">
            <TableHeader className="text-left text-muted-foreground border-b border-border">
              <TableRow>
                <TableHead className="py-3 pl-4 pr-2 w-10">
                  <Checkbox
                    checked={allSelectedOnPage(users)}
                    onCheckedChange={() => toggleAllOnPage(users)}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <TableHead className="py-3 px-3 font-medium">User</TableHead>
                <TableHead className="py-3 px-3 font-medium">Role</TableHead>
                <TableHead className="py-3 px-3 font-medium">
                  Verified
                </TableHead>
                <TableHead className="py-3 px-3 font-medium">Status</TableHead>
                <TableHead className="py-3 px-3 font-medium">Usage</TableHead>
                <TableHead className="py-3 px-3 font-medium text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="border-b border-zinc-800/70">
                    <TableCell className="py-2 pl-4 pr-2 align-top">
                      <Checkbox
                        checked={selectedIds.has(u.id)}
                        onCheckedChange={() => toggleSelected(u.id)}
                        aria-label="Select row"
                      />
                    </TableCell>

                    <TableCell className="py-3 px-3 align-top">
                      <div className="font-medium">
                        {u.displayName && <span>{u.displayName} -</span>}{" "}
                        {u.username && <span>@{u.username}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Joined {new Date(u.createdAt).toLocaleDateString()}
                        {u.lastLoginAt &&
                          ` · Last login ${new Date(
                            u.lastLoginAt,
                          ).toLocaleString()}`}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-3 align-top">
                      <Select
                        value={u.role}
                        onValueChange={(val) =>
                          void changeRole(u, val as "owner" | "admin" | "user")
                        }
                        disabled={roleBusyId === u.id}
                      >
                        <SelectTrigger className="h-8 w-35">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">owner</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="user">user</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="py-3 px-3 align-top">
                      <Switch
                        checked={u.verified}
                        disabled={verifiedBusyId === u.id}
                        onCheckedChange={(val) => void toggleVerified(u, val)}
                      />
                    </TableCell>

                    <TableCell className="py-3 px-3 align-top">
                      {banBusyId === u.id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                          <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                          Updating…
                        </span>
                      ) : u.isBanned ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs">
                              <IconBan className="h-3.5 w-3.5" /> Banned
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary p-3 text-secondary-foreground">
                            <span>
                              {u.banReason
                                ? `Reason: ${u.banReason}`
                                : "No reason provided"}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 text-xs">
                          <IconUserCheck className="h-3.5 w-3.5" /> Active
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 px-3 align-top">
                      <div className="space-y-1 text-xs">
                        <div className="text-muted-foreground">
                          {u.usage?.files ?? 0} files ·{" "}
                          {(
                            (u.usage?.storageBytes ?? 0) /
                            (1024 * 1024)
                          ).toFixed(1)}{" "}
                          MB
                        </div>
                        <div className="text-muted-foreground">
                          {u.usage?.links ?? 0} short links ·{" "}
                          {u.usage?.clicks ?? 0} clicks
                        </div>
                        {hasCustomLimits(u) && (
                          <div className="mt-1 text-[11px] text-purple-700 dark:text-purple-400">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-900/40 px-2 py-0.5">
                              Custom limits
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            Moderate
                            <IconHammer />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              {u.isBanned ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    void banUser(u, false);
                                  }}
                                  disabled={banBusyId === u.id}
                                >
                                  <IconUserCheck className="h-4 w-4" />
                                  {banBusyId === u.id ? "Unbanning…" : "Unban"}
                                </Button>
                              ) : (
                                <Dialog
                                  open={banDialogOpen && banTarget?.id === u.id}
                                  onOpenChange={(o) => {
                                    setBanDialogOpen(o);
                                    if (!o) {
                                      setBanTarget(null);
                                      setBanReason("");
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setBanTarget(u);
                                        setBanDialogOpen(true);
                                      }}
                                      disabled={banBusyId === u.id}
                                    >
                                      <IconBan className="h-4 w-4" /> Ban
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Ban this user?</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-2">
                                      <label className="text-sm text-muted-foreground">
                                        Optional reason to show on login
                                      </label>
                                      <Textarea
                                        value={banReason}
                                        onChange={(e) =>
                                          setBanReason(e.target.value)
                                        }
                                        placeholder="e.g. Payment issue, TOS violation, temporary investigation…"
                                        disabled={banBusyId === u.id}
                                      />
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        onClick={() => {
                                          setBanDialogOpen(false);
                                          setBanTarget(null);
                                          setBanReason("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          if (!banTarget) return;
                                          void banUser(
                                            banTarget,
                                            true,
                                            banReason.trim() || undefined,
                                          );
                                        }}
                                        disabled={banBusyId === u.id}
                                      >
                                        {banBusyId === u.id
                                          ? "Banning…"
                                          : "Confirm ban"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              {u.twoFactor ? (
                                <Dialog
                                  open={
                                    confirmDisable2faOpen &&
                                    disable2faTarget?.id === u.id
                                  }
                                  onOpenChange={(o) => {
                                    setConfirmDisable2faOpen(o);
                                    if (!o) setDisable2faTarget(null);
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full"
                                      disabled={disable2faBusyId === u.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setDisable2faTarget(u);
                                        setConfirmDisable2faOpen(true);
                                      }}
                                    >
                                      Disable 2FA
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        Disable 2FA for {u.email}?
                                      </DialogTitle>
                                    </DialogHeader>
                                    <p className="text-sm text-muted-foreground">
                                      This will remove their TOTP secret and
                                      backup codes. They will be able to log in
                                      with just their password until they
                                      re-enable 2FA.
                                    </p>
                                    <DialogFooter>
                                      <Button
                                        onClick={() => {
                                          setConfirmDisable2faOpen(false);
                                          setDisable2faTarget(null);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => void disable2fa(u)}
                                        disabled={disable2faBusyId === u.id}
                                      >
                                        {disable2faBusyId === u.id
                                          ? "Disabling…"
                                          : "Confirm disable"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  title="2FA is not enabled"
                                  className="w-full"
                                >
                                  2FA disabled
                                </Button>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Dialog
                                open={
                                  clearDialogOpen && clearTarget?.id === u.id
                                }
                                onOpenChange={(o) => {
                                  setClearDialogOpen(o);
                                  if (!o) setClearTarget(null);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setClearTarget(u);
                                      setClearDialogOpen(true);
                                    }}
                                  >
                                    <IconFlameFilled className="h-4 w-4" />{" "}
                                    Clear
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Clear data for {u.email}
                                    </DialogTitle>
                                  </DialogHeader>

                                  <div className="grid gap-3 text-sm">
                                    <div className="border rounded-md p-2">
                                      <div className="font-medium mb-1">
                                        Files
                                      </div>
                                      <div className="flex gap-3">
                                        <label className="inline-flex items-center gap-2 text-xs">
                                          <input
                                            type="radio"
                                            name={`files-mode-${u.id}`}
                                            checked={
                                              clearOpts.filesMode === "none"
                                            }
                                            onChange={() =>
                                              setClearOpts((o) => ({
                                                ...o,
                                                filesMode: "none",
                                              }))
                                            }
                                            disabled={clearSaving}
                                          />
                                          Do not delete files
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-xs">
                                          <input
                                            type="radio"
                                            name={`files-mode-${u.id}`}
                                            checked={
                                              clearOpts.filesMode === "all"
                                            }
                                            onChange={() =>
                                              setClearOpts((o) => ({
                                                ...o,
                                                filesMode: "all",
                                              }))
                                            }
                                            disabled={clearSaving}
                                          />
                                          Delete all files
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-xs">
                                          <input
                                            type="radio"
                                            name={`files-mode-${u.id}`}
                                            checked={
                                              clearOpts.filesMode ===
                                              "exceptFavorites"
                                            }
                                            onChange={() =>
                                              setClearOpts((o) => ({
                                                ...o,
                                                filesMode: "exceptFavorites",
                                              }))
                                            }
                                            disabled={clearSaving}
                                          />
                                          Delete all except favorites
                                        </label>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="inline-flex items-center gap-2">
                                        <Checkbox
                                          checked={clearOpts.links}
                                          onCheckedChange={(v) =>
                                            setClearOpts((o) => ({
                                              ...o,
                                              links: !!v,
                                            }))
                                          }
                                          disabled={clearSaving}
                                        />
                                        Links
                                      </label>
                                      <label className="inline-flex items-center gap-2">
                                        <Checkbox
                                          checked={clearOpts.apiTokens}
                                          onCheckedChange={(v) =>
                                            setClearOpts((o) => ({
                                              ...o,
                                              apiTokens: !!v,
                                            }))
                                          }
                                          disabled={clearSaving}
                                        />
                                        API tokens
                                      </label>
                                    </div>
                                  </div>

                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setClearDialogOpen(false)}
                                      disabled={clearSaving}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => void clearUserData()}
                                      disabled={clearSaving}
                                    >
                                      {clearSaving
                                        ? "Clearing…"
                                        : "Clear selected"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Dialog
                                open={
                                  limitsDialogOpen && limitsTarget?.id === u.id
                                }
                                onOpenChange={(o) => {
                                  setLimitsDialogOpen(o);
                                  if (!o) setLimitsTarget(null);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      openLimitsDialog(u);
                                    }}
                                  >
                                    Edit limits
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Edit limits for {u.email}
                                      <span className="block text-xs text-muted-foreground font-normal mt-1">
                                        Leave empty to use global defaults
                                      </span>
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="grid gap-3 overflow-y-auto max-h-120">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Storage cap (MB)
                                        </label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={limitsForm.maxStorageMb}
                                          onChange={(e) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              maxStorageMb: e.target.value,
                                            }))
                                          }
                                          placeholder="empty = default"
                                          disabled={limitsSaving}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Max upload (MB)
                                        </label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={limitsForm.maxUploadMb}
                                          onChange={(e) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              maxUploadMb: e.target.value,
                                            }))
                                          }
                                          placeholder="empty = default"
                                          disabled={limitsSaving}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Files limit
                                        </label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={limitsForm.filesLimit}
                                          onChange={(e) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              filesLimit: e.target.value,
                                            }))
                                          }
                                          placeholder="empty = default"
                                          disabled={limitsSaving}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Short links limit
                                        </label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={limitsForm.shortLinksLimit}
                                          onChange={(e) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              shortLinksLimit: e.target.value,
                                            }))
                                          }
                                          placeholder="empty = default"
                                          disabled={limitsSaving}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Allow Remote Upload
                                        </label>
                                        <Select
                                          value={
                                            limitsForm.allowRemoteUpload === ""
                                              ? "default"
                                              : limitsForm.allowRemoteUpload
                                          }
                                          onValueChange={(val) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              allowRemoteUpload:
                                                val === "default" ? "" : val,
                                            }))
                                          }
                                          disabled={limitsSaving}
                                        >
                                          <SelectTrigger className="w-full h-8">
                                            <SelectValue placeholder="default = server default" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="default">
                                              Use default
                                            </SelectItem>
                                            <SelectItem value="true">
                                              Allow
                                            </SelectItem>
                                            <SelectItem value="false">
                                              Disallow
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">
                                          Disable API tokens
                                        </label>
                                        <Select
                                          value={limitsForm.disableApiTokens}
                                          onValueChange={(val) =>
                                            setLimitsForm((f) => ({
                                              ...f,
                                              disableApiTokens: val,
                                            }))
                                          }
                                          disabled={limitsSaving}
                                        >
                                          <SelectTrigger className="w-full h-8">
                                            <SelectValue placeholder="" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="false">
                                              Allow
                                            </SelectItem>
                                            <SelectItem value="true">
                                              Disable
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {(
                                        [
                                          {
                                            key: "allowFiles",
                                            label: "Allow Files",
                                          },
                                          {
                                            key: "allowShortlinks",
                                            label: "Allow Shortlinks",
                                          },
                                          {
                                            key: "allowWatchlist",
                                            label: "Allow Watchlist",
                                          },
                                        ] as const
                                      ).map((item) => (
                                        <div key={item.key}>
                                          <label className="text-xs text-muted-foreground">
                                            {item.label}
                                          </label>
                                          <Select
                                            value={
                                              limitsForm[item.key] === ""
                                                ? "default"
                                                : limitsForm[item.key]
                                            }
                                            onValueChange={(val) =>
                                              setLimitsForm((f) => ({
                                                ...f,
                                                [item.key]:
                                                  val === "default" ? "" : val,
                                              }))
                                            }
                                            disabled={limitsSaving}
                                          >
                                            <SelectTrigger className="w-full h-8">
                                              <SelectValue placeholder="default = enabled" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="default">
                                                Use default
                                              </SelectItem>
                                              <SelectItem value="true">
                                                Allow
                                              </SelectItem>
                                              <SelectItem value="false">
                                                Disallow
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setLimitsDialogOpen(false)}
                                      disabled={limitsSaving}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => void saveLimits()}
                                      disabled={limitsSaving}
                                    >
                                      {limitsSaving ? "Saving…" : "Save"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Dialog
                                open={deleteDialogOpen}
                                onOpenChange={(o) => {
                                  setDeleteDialogOpen(o);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <IconTrash className="h-4 w-4" /> Delete
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete user?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-muted-foreground">
                                    This will permanently remove {u.email}. This
                                    action cannot be undone.
                                  </p>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setDeleteDialogOpen(false)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => void deleteUser(u.id)}
                                      disabled={deleteBusyId === u.id}
                                    >
                                      {deleteBusyId === u.id
                                        ? "Deleting…"
                                        : "Delete"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <PaginationFooter
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
