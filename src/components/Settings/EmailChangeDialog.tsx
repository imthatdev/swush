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

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getCurrentUser } from "@/lib/client/user";
import { Button } from "../ui/button";
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

export default function EmailChangeDialog() {
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email.");
      return false;
    }
    setEmailLoading(true);
    try {
      const { error } = await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: "/settings",
      });

      if (error) {
        toast.error(error.message || "Failed to request email change.");
        return false;
      }

      toast.success("Check your current email to approve the change.");
      setNewEmail("");
    } catch (error) {
      toast.error("Something went wrong", {
        description: error as unknown as string,
      });
      return false;
    } finally {
      setEmailLoading(false);
    }
    return true;
  };

  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUser();
      setEmail(user?.email || "");
    }
    fetchUser();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Email</CardTitle>
        <CardDescription>Change your account email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current email</p>
            <p className="text-foreground">{email || "ꕀ"}</p>
          </div>
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                Change email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change email</DialogTitle>
                <DialogDescription>
                  We’ll send a confirmation link to your current email.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="new-email" className="text-foreground">
                  New email
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@newdomain.com"
                  disabled={emailLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Approve the change from the email we send you.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  const ok = await handleChangeEmail();
                  if (ok) setEmailOpen(false);
                }}
                disabled={emailLoading || !newEmail.trim()}
              >
                {emailLoading ? "Requesting..." : "Request email change"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
