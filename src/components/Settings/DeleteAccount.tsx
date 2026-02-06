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

import React, { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useUser } from "@/hooks/use-user";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export default function DeleteAccount() {
  const { user } = useUser();
  const isOwner = user?.role === "owner";
  const [confirmText, setConfirmText] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirmValid = confirmText.trim().toUpperCase() === "DELETE";
  const canSubmit = confirmChecked && confirmValid;

  const handleDelete = async () => {
    if (isOwner) {
      toast.error("Owner accounts cannot be deleted.");
      return;
    }
    if (!canSubmit) {
      toast.error("Please confirm deletion first.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.deleteUser({
        callbackURL: "/goodbye",
      });

      if (error) {
        toast.error(error.message || "Failed to delete account.");
        return;
      }

      toast.success(
        "Check your email to confirm deletion. The link will finish the process.",
      );
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-xl">Danger zone</CardTitle>
          <CardDescription>
            We’ll email you a verification link to confirm account deletion.
            Which will permanently remove your account and all associated data.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Owner accounts cannot be deleted.
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm" className="text-foreground">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isOwner}
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <Checkbox
              id="delete-confirm-check"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(Boolean(checked))}
              disabled={isOwner}
            />
            <div className="space-y-1">
              <Label htmlFor="delete-confirm-check" className="text-foreground">
                I understand this action is permanent.
              </Label>
              <p className="text-xs text-muted-foreground">
                All data tied to your account will be removed.
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canSubmit || loading || isOwner}
          >
            {loading ? "Deleting..." : "Delete account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
