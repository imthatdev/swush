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

import {
  IconClipboard,
  IconX,
  IconLoader,
  IconTrash,
} from "@tabler/icons-react";
import { format } from "date-fns";
import {
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Skeleton } from "../ui/skeleton";
import ShareX from "@/components/Icons/ShareX";
import CopyButton from "@/components/Common/CopyButton";
import { APIKey } from "@/types/schema";
import {
  clearExpiredApiKeys,
  createApiKey,
  deleteApiKey,
  listedApiKeys,
  revokeApiKey,
} from "@/lib/client/apiTokens";
import { apiV1Path } from "@/lib/api-path";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationFooter } from "@/components/Shared/PaginationFooter";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  API_KEY_SCOPES,
  DEFAULT_API_KEY_SCOPES,
  type ApiKeyScope,
} from "@/lib/api-key-scopes";
import { normalizeApiKeyScopes } from "@/lib/api-key-scopes";

import {
  NAME_CONVENTION_LABELS,
  NAME_CONVENTIONS,
  SLUG_CONVENTION_LABELS,
  SLUG_CONVENTIONS,
} from "@/lib/upload-conventions";
import type { NameConvention, SlugConvention } from "@/lib/upload-conventions";
import IShare from "../Icons/IShare";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import {
  handleExportIShare,
  handleExportShareX,
  ShareXDestination,
} from "./SharerExporter";

export function ApiTokens() {
  const { appUrl } = useAppConfig();
  const [tokens, setTokens] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [showToken, setShowToken] = useState<{
    token: string;
    name: string;
  } | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [clearLoading, setClearLoading] = useState(false);
  const [tokenScopes, setTokenScopes] = useState<Set<ApiKeyScope>>(
    new Set(DEFAULT_API_KEY_SCOPES),
  );
  const [sharexDialogOpen, setSharexDialogOpen] = useState(false);
  const [sharexDestination, setSharexDestination] =
    useState<ShareXDestination>("upload");
  const [sharexPublic, setSharexPublic] = useState(true);
  const [sharexMaxViews, setSharexMaxViews] = useState("");
  const [sharexFolderName, setSharexFolderName] = useState("");
  const [sharexXshareCompat, setSharexXshareCompat] = useState(false);
  const [sharexNameConvention, setSharexNameConvention] =
    useState<NameConvention>("original");
  const [sharexSlugConvention, setSharexSlugConvention] =
    useState<SlugConvention>("funny");
  const [sharexTarget, setSharexTarget] = useState<{
    key: string;
    name?: string | null;
  } | null>(null);
  const [secretCache, setSecretCache] = useState<Record<string, string>>({});
  const { page, setPage, totalPages, paginatedItems } = usePagination(
    tokens,
    6,
  );

  const rememberKey = (id: string, key: string) => {
    setSecretCache((prev) => ({ ...prev, [id]: key }));
  };

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const apiKeys = await listedApiKeys();
      setTokens(apiKeys);
    } catch (error) {
      toast.error(error as string, {
        description: "Failed to fetch API tokens",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [refreshFlag]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      toast.error("Token name required");
      return;
    }
    setCreating(true);
    try {
      const expiresIn = expiryDays
        ? parseInt(expiryDays, 10) * 24 * 60 * 60
        : undefined;

      const apiKeyCreated = await createApiKey({
        name: tokenName.trim(),
        expiresIn,
        scopes: Array.from(tokenScopes),
      });

      setDialogOpen(false);
      setTokenName("");
      setExpiryDays("");
      setTokenScopes(new Set(DEFAULT_API_KEY_SCOPES));
      setShowToken({
        token: apiKeyCreated.key,
        name: tokenName.trim(),
      });
      if (apiKeyCreated.id && apiKeyCreated.key) {
        rememberKey(String(apiKeyCreated.id), apiKeyCreated.key);
      }

      setRefreshFlag((f) => f + 1);
      toast.success("Token created! Copy and save it now.");
    } catch (err) {
      toast.error(`Failed to create token: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setTokenScopes((prev) => {
      const next = new Set(prev);
      if (scope === "all") {
        if (next.has("all")) {
          next.delete("all");
        } else {
          next.clear();
          next.add("all");
        }
      } else {
        next.delete("all");
        if (next.has(scope)) {
          next.delete(scope);
        } else {
          next.add(scope);
        }
      }

      if (next.size === 0) next.add("all");
      return next;
    });
  };

  const handleRevoke = async (id: string) => {
    setRevokingIds((s) => new Set([...Array.from(s), id]));
    try {
      await revokeApiKey(id);
      toast.success("Token revoked");
      setRefreshFlag((f) => f + 1);
    } catch (err) {
      toast.error(`Failed to revoke token`, {
        description: (err as Error).message,
      });
    } finally {
      setRevokingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const handleClearExpired = async () => {
    setClearLoading(true);
    try {
      await clearExpiredApiKeys();
      toast.success("All expired tokens cleared");
      setRefreshFlag((f) => f + 1);
    } catch (err) {
      toast.error(`Failed to clear expired tokens`, {
        description: (err as Error).message,
      });
    } finally {
      setClearLoading(false);
      setClearOpen(false);
    }
  };

  const handleKeyDelete = async (id: string) => {
    setDeletingIds((s) => new Set([...Array.from(s), id]));
    try {
      await deleteApiKey(id);
      toast.success("API key deleted");
      setRefreshFlag((f) => f + 1);
    } catch (err) {
      toast.error(`Failed to delete API key`, {
        description: (err as Error).message,
      });
    } finally {
      setDeletingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const fetchApiKeySecret = async (id: string) => {
    const cached = secretCache[id];
    if (cached) return cached;
    const res = await fetch(apiV1Path("/profile/api-keys", id, "secret"), {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Unable to fetch API key");
    }
    const data = (await res.json()) as { key?: string };
    if (!data?.key) throw new Error("API key not available");
    setSecretCache((prev) => ({ ...prev, [id]: data.key as string }));
    return data.key;
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="default"
              onClick={() => setDialogOpen(true)}
              disabled={tokens.length >= 9}
              title={tokens.length >= 9 ? "Token limit reached (9)" : undefined}
            >
              Create New Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Token</DialogTitle>
              <DialogDescription>
                Name your token and optionally set an expiry (in days).
                You&apos;ll only see the token once.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="token-name">Name</Label>
                <Input
                  id="token-name"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. ShareX Desktop"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiry-days">Expiry (days, optional)</Label>
                <Input
                  id="expiry-days"
                  type="number"
                  min={1}
                  value={expiryDays}
                  onChange={(e) =>
                    setExpiryDays(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="e.g. 30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Scopes</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {API_KEY_SCOPES.map((scope) => {
                    const isChecked = tokenScopes.has(scope.id);

                    return (
                      <label
                        key={scope.id}
                        className="flex items-start gap-3 rounded-md border px-3 py-2 text-left"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() =>
                            toggleScope(scope.id as ApiKeyScope)
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {scope.label}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {scope.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  API keys can only access the allowlisted API routes. Pick
                  scopes to further restrict access.
                </p>
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2">
              {tokens.length >= 9 && (
                <div className="text-sm text-muted-foreground">
                  You have reached the maximum of 9 API tokens. Revoke or delete
                  an existing token to create a new one.
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={handleCreateToken}
                  disabled={creating || !tokenName.trim() || tokens.length >= 9}
                >
                  {creating ? "Creating..." : "Create Token"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" onClick={() => setClearOpen(true)}>
              Clear All Expired Tokens
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Expired Tokens</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete all expired API
                tokens? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setClearOpen(false)}
                disabled={clearLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearExpired}
                disabled={clearLoading}
              >
                {clearLoading ? "Clearing..." : "Clear Expired Tokens"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {showToken && (
        <div className="mb-4 bg-muted p-3 flex flex-wrap justify-between items-center gap-2 rounded-lg">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span className="font-mono text-sm break-all">
              {showToken.token}
            </span>
            <div className="flex items-center">
              <CopyButton
                size="icon"
                variant="ghost"
                successMessage="Token copied!"
                getText={() => showToken.token}
                title="Copy token"
                className=""
              >
                <IconClipboard className="h-4 w-4" />
              </CopyButton>
              <span className="text-xs text-muted-foreground">
                (Copy and save this token now!)
              </span>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => {
                setSharexTarget({
                  key: showToken.token,
                  name: showToken.name,
                });
                setSharexDialogOpen(true);
              }}
            >
              <ShareX /> Generate ShareX Uploader
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSharexTarget({
                  key: showToken.token,
                  name: showToken.name,
                });
                setSharexDialogOpen(true);
              }}
            >
              <IShare className="h-4 w-4" /> Generate iShare Config
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowToken(null)}
              title="Dismiss"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {sharexDialogOpen && sharexTarget ? (
        <Dialog open={sharexDialogOpen} onOpenChange={setSharexDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Uploader Config</DialogTitle>
              <DialogDescription>
                Pick your destination and defaults before exporting the ShareX
                or iShare configuration.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Destination Type</Label>
                <Select
                  value={sharexDestination}
                  onValueChange={(value) =>
                    setSharexDestination(value as ShareXDestination)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">Upload file</SelectItem>
                    <SelectItem value="shortener">Shorten URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">Public</div>
                    <div className="text-xs text-muted-foreground">
                      Allow public access to the upload.
                    </div>
                  </div>
                  <Switch
                    checked={sharexPublic}
                    onCheckedChange={setSharexPublic}
                  />
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-md border px-3 py-2">
                  <Label>Folder</Label>
                  <Input
                    value={sharexFolderName}
                    onChange={(e) => setSharexFolderName(e.target.value)}
                    placeholder="Optional folder name"
                    disabled={sharexDestination === "shortener"}
                  />
                  {sharexDestination === "shortener" && (
                    <p className="text-xs text-muted-foreground">
                      Folder is available for uploads only.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Views</Label>
                <Input
                  value={sharexMaxViews}
                  onChange={(e) =>
                    setSharexMaxViews(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Leave blank for unlimited"
                  disabled={sharexDestination === "upload"}
                />
                {sharexDestination === "upload" && (
                  <p className="text-xs text-muted-foreground">
                    Max views is available for short links only.
                  </p>
                )}
              </div>

              {sharexDestination === "upload" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name convention</Label>
                    <Select
                      value={sharexNameConvention}
                      onValueChange={(value) =>
                        setSharexNameConvention(value as NameConvention)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a naming style" />
                      </SelectTrigger>
                      <SelectContent>
                        {NAME_CONVENTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {NAME_CONVENTION_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Slug convention</Label>
                    <Select
                      value={sharexSlugConvention}
                      onValueChange={(value) =>
                        setSharexSlugConvention(value as SlugConvention)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a slug style" />
                      </SelectTrigger>
                      <SelectContent>
                        {SLUG_CONVENTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {SLUG_CONVENTION_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">
                    Xshare Compatibility
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Generates a config tuned for Xshare on Android (not for
                    ShareX).
                  </div>
                </div>
                <Switch
                  checked={sharexXshareCompat}
                  onCheckedChange={setSharexXshareCompat}
                />
              </div>
              {sharexDestination === "shortener" && (
                <p className="text-xs text-muted-foreground">
                  iShare supports upload configs only.
                </p>
              )}
            </div>
            <DialogFooter className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={() => {
                  handleExportShareX({
                    key: sharexTarget.key,
                    name: sharexTarget.name,
                    destination: sharexDestination,
                    isPublic: sharexPublic,
                    maxViews: sharexMaxViews,
                    folderName: sharexFolderName,
                    nameConvention: sharexNameConvention,
                    slugConvention: sharexSlugConvention,
                    xshareCompat: sharexXshareCompat,
                    appUrl: appUrl,
                  });
                }}
              >
                Generate ShareX Config
              </Button>
              <Button
                disabled={sharexDestination === "shortener"}
                onClick={() => {
                  handleExportIShare({
                    key: sharexTarget.key,
                    name: sharexTarget.name,
                    destination: sharexDestination,
                    isPublic: sharexPublic,
                    folderName: sharexFolderName,
                    nameConvention: sharexNameConvention,
                    slugConvention: sharexSlugConvention,
                    appUrl: appUrl,
                  });
                }}
              >
                Generate iShare Config
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      <div className="overflow-x-auto rounded-md">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-2 px-3 text-left">Name</TableHead>
              <TableHead className="py-2 px-3 text-left">Scopes</TableHead>
              <TableHead className="py-2 px-3 text-left">Created</TableHead>
              <TableHead className="py-2 px-3 text-left">Expiry</TableHead>
              <TableHead className="py-2 px-3 text-left">Status</TableHead>
              <TableHead className="py-2 px-3 text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="opacity-70">
                  <TableCell className="py-2 px-3 font-medium">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="py-2 px-3 flex gap-1">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : tokens.length === 0 ? (
            <TableCaption className="py-4 text-center text-muted-foreground">
              No API tokens
            </TableCaption>
          ) : (
            <TableBody>
              {paginatedItems.map((token) => (
                <TableRow
                  key={token.id}
                  className={token.enabled ? "" : "opacity-60"}
                >
                  <TableCell className="py-2 px-3 font-medium">
                    {token.name}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {(() => {
                      const scopes = normalizeApiKeyScopes(
                        (
                          token as {
                            permissions?:
                              | string
                              | Record<string, unknown>
                              | null;
                          }
                        ).permissions ?? null,
                      );
                      const labels = API_KEY_SCOPES.reduce<
                        Record<string, string>
                      >((acc, scope) => {
                        acc[scope.id] = scope.label;
                        return acc;
                      }, {});
                      const items = Array.from(scopes);
                      if (!items.length) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      if (items.includes("all")) {
                        return <Badge variant="secondary">All</Badge>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1">
                          {items.map((scope) => (
                            <Badge
                              key={scope}
                              variant="outline"
                              className="text-xs"
                            >
                              {labels[scope] || scope}
                            </Badge>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {token.createdAt
                      ? format(new Date(token.createdAt), "yyyy-MM-dd")
                      : "--"}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {token.expiresAt ? (
                      format(new Date(token.expiresAt), "yyyy-MM-dd")
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span
                      className={
                        token.enabled ? "text-green-600" : "text-red-400"
                      }
                    >
                      {token.enabled ? "Active" : "Revoked"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 flex gap-1 w-full">
                    <CopyButton
                      size="sm"
                      variant="outline"
                      title="Copy API key"
                      successMessage="API key copied"
                      errorMessage="Unable to load API key"
                      getText={() => fetchApiKeySecret(token.id)}
                    >
                      <IconClipboard className="h-4 w-4" />
                    </CopyButton>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Generate ShareX config"
                      onClick={async () => {
                        try {
                          const key = await fetchApiKeySecret(token.id);
                          setSharexTarget({
                            key,
                            name: token.name,
                          });
                          setSharexDialogOpen(true);
                        } catch (err) {
                          toast.error("Unable to load API key", {
                            description: (err as Error).message,
                          });
                        }
                      }}
                    >
                      <ShareX />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Generate iShare config"
                      onClick={async () => {
                        try {
                          const key = await fetchApiKeySecret(token.id);
                          setSharexTarget({
                            key,
                            name: token.name,
                          });
                          setSharexDialogOpen(true);
                        } catch (err) {
                          toast.error("Unable to load API key", {
                            description: (err as Error).message,
                          });
                        }
                      }}
                    >
                      <IShare className="h-5 w-5 rounded-md" />
                    </Button>
                    {token.enabled ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevoke(token.id)}
                        title="Revoke token"
                        disabled={revokingIds.has(token.id)}
                      >
                        {revokingIds.has(token.id) ? (
                          <>
                            <IconLoader className="h-4 w-4 animate-spin mr-2" />
                            Revoking...
                          </>
                        ) : (
                          "Revoke"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleKeyDelete(token.id)}
                        title="Delete token"
                        disabled={deletingIds.has(token.id)}
                      >
                        {deletingIds.has(token.id) ? (
                          <IconLoader className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>
      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}
