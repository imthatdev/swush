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
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ExternalLayout from "../Common/ExternalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiV1 } from "@/lib/api-path";

type VerifyAction = "approve" | "deny";
type VerifyStatus = "approved" | "denied" | "idle";

const formatUserCode = (value: string) => {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
};

export default function DeviceFlowVerifyClient() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [loadingAction, setLoadingAction] = useState<VerifyAction | "">("");

  useEffect(() => {
    const initialCode = searchParams.get("user_code");
    if (initialCode) {
      setCode(formatUserCode(initialCode));
    }
  }, [searchParams]);

  const isReady = useMemo(() => code.replace("-", "").length === 8, [code]);

  const submit = async (action: VerifyAction) => {
    if (!isReady) {
      toast.error("Enter the 8-character code from your device.");
      return;
    }

    setLoadingAction(action);
    try {
      const response = await fetch(apiV1("/auth/device/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_code: code,
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data?.error || "Verification failed");
        return;
      }

      setStatus(data?.status ?? (action === "deny" ? "denied" : "approved"));
      toast.success(
        action === "approve"
          ? "Device authorized. You can return to the extension."
          : "Device request denied.",
      );
    } catch {
      toast.error("Verification failed");
    } finally {
      setLoadingAction("");
    }
  };

  return (
    <ExternalLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authorize Device</CardTitle>
          <CardDescription>
            Enter the code shown in your extension to approve access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={code}
            onChange={(event) => setCode(formatUserCode(event.target.value))}
            placeholder="XXXX-XXXX"
            inputMode="text"
            autoComplete="one-time-code"
            className="text-center tracking-[0.3em]"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => submit("approve")}
              disabled={!isReady || loadingAction !== ""}
            >
              {loadingAction === "approve" ? "Approving..." : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => submit("deny")}
              disabled={!isReady || loadingAction !== ""}
            >
              {loadingAction === "deny" ? "Denying..." : "Deny"}
            </Button>
          </div>
          {status !== "idle" && (
            <div className="rounded-md border bg-muted/60 p-3 text-sm text-muted-foreground">
              {status === "approved"
                ? "Approved. You can close this tab."
                : "Denied. If this was unexpected, ignore the device request."}
            </div>
          )}
        </CardContent>
      </Card>
    </ExternalLayout>
  );
}
