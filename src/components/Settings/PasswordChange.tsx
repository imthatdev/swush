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

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { setMyPassword } from "@/lib/server/user/auth";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import EmailChangeDialog from "./EmailChangeDialog";
import PasskeysManager from "./PasskeysManager";
import TwoFactorAuthentication from "./TwoFactorAuthentication";
import { cn } from "@/lib/utils";

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          className="pr-10"
          onChange={onChange}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xl cursor-pointer bg-transparent border-0 outline-none"
          style={{ background: "none", border: "none" }}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "🙈" : "🐵"}
        </button>
      </div>
    </div>
  );
}

function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  hasPasswordAccount: boolean,
): string | null {
  if (hasPasswordAccount && !currentPassword) {
    return "Please enter your current password.";
  }

  if (!newPassword || !confirmPassword) {
    return "Please fill in all fields.";
  }

  if (newPassword.length < 8) {
    return "New password must be at least 8 characters.";
  }

  if (newPassword !== confirmPassword) {
    return "New passwords do not match.";
  }

  return null;
}

function isCredentialProvider(providerId?: string | null) {
  if (!providerId) return false;
  const value = providerId.toLowerCase();
  return (
    value.includes("credentials") ||
    value.includes("credential") ||
    value.includes("email") ||
    value.includes("password")
  );
}

export default function PasswordChange() {
  const [hasPasswordAccount, setHasPasswordAccount] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [shouldRevokeOtherSessions, setShouldRevokeOtherSessions] =
    useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { data } = await authClient.listAccounts();
        const accounts = (data as { providerId?: string | null }[]) || [];
        setHasPasswordAccount(
          accounts.some((a) => isCredentialProvider(a.providerId)),
        );
      } catch {
        setHasPasswordAccount(true);
      }
    };
    void loadAccounts();
  }, []);

  const changePassword = async () => {
    const validationError = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmPassword,
      hasPasswordAccount,
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPasswordLoading(true);
    try {
      if (hasPasswordAccount) {
        const { error } = await authClient.changePassword({
          newPassword,
          currentPassword,
          revokeOtherSessions: shouldRevokeOtherSessions,
        });

        if (error) {
          toast.error(error.message || "Something went wrong");
          return;
        }

        toast.success("Password updated successfully.");
      } else {
        const result = await setMyPassword({ newPassword });
        if (!result.ok) {
          toast.error(result.error || "Failed to set password");
          return;
        }
        toast.success("Password set successfully.");
        setHasPasswordAccount(true);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } catch {
      toast.error("Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!hasPasswordAccount && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Set a password to enable 2FA and passkeys.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {hasPasswordAccount ? "Change password" : "Set password"}
          </CardTitle>
          <CardDescription>
            {hasPasswordAccount
              ? "Update your password and optionally revoke other active sessions."
              : "Add a password so you can enable 2FA and passkeys."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Password</p>
              <p className="text-foreground">
                {hasPasswordAccount ? "••••••••" : "Not set"}
              </p>
            </div>
            <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  {hasPasswordAccount ? "Change password" : "Set password"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {hasPasswordAccount ? "Change password" : "Set password"}
                  </DialogTitle>
                  <DialogDescription>
                    {hasPasswordAccount
                      ? "Update your password and optionally revoke other sessions."
                      : "Create a password to enable 2FA and passkeys."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  {hasPasswordAccount && (
                    <PasswordField
                      id="current-password"
                      label="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      show={showCurrentPassword}
                      onToggle={() => setShowCurrentPassword((v) => !v)}
                    />
                  )}
                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword((v) => !v)}
                  />
                  <PasswordField
                    id="confirm-password"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((v) => !v)}
                  />
                </div>
                {hasPasswordAccount && (
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      id="revoke-sessions"
                      checked={shouldRevokeOtherSessions}
                      onCheckedChange={(checked) =>
                        setShouldRevokeOtherSessions(!!checked)
                      }
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="revoke-sessions"
                        className="text-foreground"
                      >
                        Revoke other sessions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Sign out of other devices after changing your password.
                      </p>
                    </div>
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={changePassword}
                  disabled={passwordLoading}
                >
                  {passwordLoading
                    ? "Saving..."
                    : hasPasswordAccount
                      ? "Save password"
                      : "Set password"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <EmailChangeDialog />

      <div
        className={cn(
          "space-y-4",
          !hasPasswordAccount && "opacity-50 pointer-events-none",
        )}
      >
        <Card>
          <CardContent>
            <TwoFactorAuthentication />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <PasskeysManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
