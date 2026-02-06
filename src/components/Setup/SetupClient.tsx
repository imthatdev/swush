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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { apiV1 } from "@/lib/api-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type SetupDefaults = {
  allowPublicRegistration: boolean;
  passwordPolicyMinLength: number;
  maxUploadMb: number;
  maxFilesPerUpload: number;
};

type SetupClientProps = {
  defaults: SetupDefaults;
};

export default function SetupClient({ defaults }: SetupClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const [allowPublicRegistration, setAllowPublicRegistration] = useState(
    defaults.allowPublicRegistration,
  );
  const [passwordPolicyMinLength, setPasswordPolicyMinLength] = useState(
    defaults.passwordPolicyMinLength,
  );
  const [maxUploadMb, setMaxUploadMb] = useState(defaults.maxUploadMb);
  const [maxFilesPerUpload, setMaxFilesPerUpload] = useState(
    defaults.maxFilesPerUpload,
  );

  const stepLabel = useMemo(() => {
    if (step === 1) return "Owner account";
    return "Server settings";
  }, [step]);

  const handleOwnerCreate = async () => {
    if (!ownerEmail.trim() || !ownerUsername.trim() || !ownerPassword.trim()) {
      toast.error("Fill out all owner fields.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await authClient.signUp.email({
        email: ownerEmail.trim().toLowerCase(),
        username: ownerUsername.trim().toLowerCase(),
        password: ownerPassword,
        name: ownerUsername.trim(),
      });
      if (error) throw new Error(error.message);
      const id = data?.user?.id;
      if (!id) throw new Error("Unable to create owner account.");
      setOwnerId(id);
      setStep(2);
    } catch (err) {
      toast.error("Owner setup failed", {
        description: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!ownerId) {
      toast.error("Owner account missing.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiV1("/setup/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowPublicRegistration,
          passwordPolicyMinLength,
          maxUploadMb,
          maxFilesPerUpload,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to save server settings.");
      }
      const done = await fetch(apiV1("/setup/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      });
      if (!done.ok) {
        const data = await done.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to finalize setup.");
      }
      toast.success("Setup complete", {
        description: "Log in to access your admin dashboard.",
      });
      router.replace("/login");
    } catch (err) {
      toast.error("Setup failed", {
        description: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
            <p className="text-sm text-muted-foreground">
              Configure your Swush instance in three steps.
            </p>
          </div>
        <Badge variant="secondary">Step {step} of 2 · {stepLabel}</Badge>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Create owner account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@example.com"
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Username</Label>
                  <Input
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value)}
                    placeholder="owner"
                    disabled={busy}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Create a strong password"
                  disabled={busy}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleOwnerCreate} disabled={busy}>
                  {busy ? "Creating..." : "Create owner"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Server settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">
                    Allow public registration
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Disable to require invites or admin-created accounts.
                  </div>
                </div>
                <Switch
                  checked={allowPublicRegistration}
                  onCheckedChange={setAllowPublicRegistration}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Password min length</Label>
                  <Input
                    type="number"
                    value={passwordPolicyMinLength}
                    onChange={(e) =>
                      setPasswordPolicyMinLength(Number(e.target.value || 0))
                    }
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Max file size (MB)</Label>
                  <Input
                    type="number"
                    value={maxUploadMb}
                    onChange={(e) => setMaxUploadMb(Number(e.target.value || 0))}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Max files per upload</Label>
                  <Input
                    type="number"
                    value={maxFilesPerUpload}
                    onChange={(e) =>
                      setMaxFilesPerUpload(Number(e.target.value || 0))
                    }
                    disabled={busy}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={handleSettingsSave} disabled={busy}>
                  {busy ? "Finishing..." : "Finish setup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
