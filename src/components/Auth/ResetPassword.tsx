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

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { IconEye, IconEyeClosed } from "@tabler/icons-react";
import ExternalLayout from "../Common/ExternalLayout";

export default function ResetPasswordClient() {
  return (
    <ExternalLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 shadow-lg">
              Loading...
            </div>
          </div>
        }
      >
        <ResetPasswordFormInner />
      </Suspense>
    </ExternalLayout>
  );
}

function ResetPasswordFormInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        toast.error("Password reset failed", {
          description: error.message,
        });
        return;
      }
      toast.success("Password reset successful", {
        description: "You can now log in with your new password.",
      });
      router.push("/login");
    } catch {
      toast.error("Unexpected error while resetting password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center bg-background px-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border/50 bg-card/80 p-8 shadow-lg backdrop-blur-sm"
      >
        <h1 className="text-center text-2xl font-semibold">Reset Password</h1>
        {!token ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 p-3">
              This reset link is invalid or expired.
            </p>
            <Link href="/request-password" className="inline-block underline">
              Request a new reset link
            </Link>
          </div>
        ) : (
          <>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter new password"
                minLength={8}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <IconEyeClosed size={16} />
                ) : (
                  <IconEye size={16} />
                )}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner /> : "Reset Password"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
