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
  IconTrash,
  IconLoader,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconWorld,
} from "@tabler/icons-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
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
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Session } from "@/types/schema";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationFooter } from "@/components/Shared/PaginationFooter";

function formatDate(d?: string | null) {
  if (!d) return "ꕀ";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function getDeviceMeta(userAgent?: string | null) {
  const raw = userAgent?.trim() || "";
  const ua = raw.toLowerCase();

  if (!ua) {
    return {
      label: "Unknown device",
      description: "No user agent detected",
      Icon: IconDeviceDesktop,
    };
  }

  if (ua.includes("swush desktop") || ua.includes("tauri")) {
    return {
      label: "Swush Desktop App",
      description: raw,
      Icon: IconDeviceDesktop,
    };
  }

  if (
    ua.includes("swush mobile") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ios")
  ) {
    return {
      label: "Swush Mobile App",
      description: raw,
      Icon: IconDeviceMobile,
    };
  }

  if (ua.includes("ipad") || ua.includes("tablet")) {
    return {
      label: "Tablet",
      description: raw,
      Icon: IconDeviceTablet,
    };
  }

  if (
    ua.includes("chrome") ||
    ua.includes("safari") ||
    ua.includes("firefox")
  ) {
    return {
      label: "Web Browser",
      description: raw,
      Icon: IconWorld,
    };
  }

  return {
    label: "Device",
    description: raw,
    Icon: IconDeviceDesktop,
  };
}

export default function SessionsSection() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [revokeOthersLoading, setRevokeOthersLoading] = useState(false);
  const { page, setPage, totalPages, paginatedItems } = usePagination(
    items ?? [],
    10,
  );

  const load = async () => {
    setLoading(true);
    try {
      const { data: response, error } = await authClient.listSessions();
      const { data: currentSession } = await authClient.getSession();

      if (error) {
        toast.error(error.message || "Failed to load sessions");
      }

      setItems(response);
      setBusyId(currentSession?.session.token ?? null);
    } catch (e) {
      toast.error("Failed to load sessions", {
        description: (e as Error).message,
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const revoke = async (token: string) => {
    setRevokingIds((s) => new Set([...Array.from(s), token]));
    try {
      await authClient.revokeSession({ token });
      await load();
      toast.success("Session revoked");
    } catch (e) {
      toast.error("Could not revoke session", {
        description: (e as Error).message,
      });
    } finally {
      setRevokingIds((s) => {
        const n = new Set(s);
        n.delete(token);
        return n;
      });
    }
  };

  const revokeOthers = async () => {
    setRevokeOthersLoading(true);
    try {
      await authClient.revokeOtherSessions();
      toast.success("Logged out from other devices");
      await load();
    } catch (e) {
      toast.error("Could not log out of other devices", {
        description: (e as Error).message,
      });
    } finally {
      setRevokeOthersLoading(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading || busyId === null}
        >
          {loading ? (
            <>
              <IconLoader className="h-4 w-4 animate-spin mr-2" />
              Refreshing...
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={revokeOthers}
          disabled={
            loading ||
            items?.length === 0 ||
            busyId === null ||
            revokeOthersLoading
          }
        >
          {revokeOthersLoading ? (
            <>
              <IconLoader className="h-4 w-4 animate-spin mr-2" />
              Logging out...
            </>
          ) : (
            "Log out of other devices"
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-2 px-3 text-left">Device</TableHead>
              <TableHead className="py-2 px-3 text-left">IP</TableHead>
              <TableHead className="py-2 px-3 text-left">Expires</TableHead>
              <TableHead className="py-2 px-3 text-left">Status</TableHead>
              <TableHead className="py-2 px-3 text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>

          {loading ? (
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`sess-skel-${i}`} className="opacity-70">
                  <TableCell className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-6" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="py-2 px-3 flex gap-2">
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : !items || items.length === 0 ? (
            <TableCaption className="py-4 text-center text-muted-foreground">
              No active sessions
            </TableCaption>
          ) : (
            <TableBody>
              {paginatedItems.map((s) => {
                const meta = getDeviceMeta(s.userAgent);
                const Icon = meta.Icon;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="py-2 px-3" title={meta.description}>
                      <div className="flex items-center gap-2">
                        <Icon size={16} />
                        <div className="flex flex-col">
                          <span className="font-medium break-all max-w-sm truncate">
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-sm">
                            {meta.description}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      {s.ipAddress || (
                        <span className="text-muted-foreground">
                          IP unknown
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      {formatDate(
                        s.expiresAt instanceof Date
                          ? s.expiresAt.toISOString()
                          : (s.expiresAt as unknown as string),
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      {s.token === busyId ? (
                        <Badge variant="default">Current</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 flex gap-2">
                      {s.token !== busyId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke(s.token)}
                          disabled={!busyId || revokingIds.has(s.token)}
                        >
                          {revokingIds.has(s.token) ? (
                            <>
                              <IconLoader className="h-4 w-4 animate-spin mr-2" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <IconTrash size={16} /> Revoke
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
