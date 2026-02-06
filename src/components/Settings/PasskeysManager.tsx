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
import { authClient } from "@/lib/auth-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CardHeader, CardTitle, CardDescription } from "../ui/card";

type PasskeyItem = {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  backedUp?: boolean | null;
  createdAt?: string | Date | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "ꕀ";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "ꕀ";
  return d.toLocaleDateString();
}

export default function PasskeysManager() {
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [attachment, setAttachment] = useState<"platform" | "cross-platform">(
    "cross-platform",
  );

  const [renameTarget, setRenameTarget] = useState<PasskeyItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PasskeyItem | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setPasskeySupported(
      typeof window !== "undefined" && "PublicKeyCredential" in window,
    );
    loadPasskeys();
  }, []);

  const loadPasskeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.passkey.listUserPasskeys();
      if (error) {
        toast.error(error.message || "Failed to load passkeys");
        return;
      }
      setPasskeys((data ?? []) as PasskeyItem[]);
    } catch {
      toast.error("Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Passkey name is required");
      return;
    }
    setAddLoading(true);
    try {
      const { error } = await authClient.passkey.addPasskey({
        name,
        authenticatorAttachment: attachment,
      });
      if (error) {
        toast.error(error.message || "Failed to add passkey");
        return;
      }
      toast.success("Passkey added");
      setAddOpen(false);
      setNewName("");
      await loadPasskeys();
    } catch {
      toast.error("Failed to add passkey");
    } finally {
      setAddLoading(false);
    }
  };

  const openRename = (item: PasskeyItem) => {
    setRenameTarget(item);
    setRenameValue(item.name ?? "");
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Passkey name is required");
      return;
    }
    setRenameLoading(true);
    try {
      const { error } = await authClient.passkey.updatePasskey({
        id: renameTarget.id,
        name,
      });
      if (error) {
        toast.error(error.message || "Failed to rename passkey");
        return;
      }
      toast.success("Passkey renamed");
      setRenameTarget(null);
      await loadPasskeys();
    } catch {
      toast.error("Failed to rename passkey");
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!deletePassword.trim()) {
      toast.error("Enter your password to confirm deletion");
      return;
    }
    setDeleteLoading(true);
    try {
      const { error } = await authClient.passkey.deletePasskey({
        id: deleteTarget.id,
      });
      if (error) {
        toast.error(error.message || "Failed to delete passkey");
        return;
      }
      toast.success("Passkey deleted");
      setDeleteTarget(null);
      setDeletePassword("");
      await loadPasskeys();
    } catch {
      toast.error("Failed to delete passkey");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle className="text-xl">Passkeys</CardTitle>
        <CardDescription>
          Create and manage passkeys for faster, passwordless sign‑in.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-wrap gap-2">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" disabled={!passkeySupported}>
              Add passkey
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New passkey</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="passkey-name">Name</Label>
                <Input
                  id="passkey-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="MacBook Pro"
                />
              </div>
              <div className="grid gap-2">
                <Label>Attachment</Label>
                <Select
                  value={attachment}
                  onValueChange={(value) =>
                    setAttachment(value as "platform" | "cross-platform")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">This device</SelectItem>
                    <SelectItem value="cross-platform">
                      External security key
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddPasskey} disabled={addLoading}>
                {addLoading ? "Adding..." : "Add passkey"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" onClick={loadPasskeys} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>

        {!passkeySupported && (
          <p className="text-xs text-muted-foreground">
            Passkeys are not supported on this device.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passkeys yet.</p>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {pk.name || "Unnamed passkey"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pk.deviceType ? `${pk.deviceType} • ` : ""}
                  {pk.backedUp ? "Backed up" : "Not backed up"} • Created{" "}
                  {formatDate(pk.createdAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openRename(pk)}>
                  Rename
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(pk)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename passkey</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-passkey">Name</Label>
            <Input
              id="rename-passkey"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={renameLoading}>
              {renameLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeletePassword("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              This passkey will be removed from your account and can no longer
              be used to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="delete-passkey-password">Confirm password</Label>
            <Input
              id="delete-passkey-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
