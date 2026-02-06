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

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ExternalLayout from "../Common/ExternalLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function ResetPasswordRequestClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo,
      });
      if (error) {
        toast.error(error.message || "Failed to send reset link");
      } else {
        toast.success("Password reset link sent to your email");
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ExternalLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your email address to receive a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center">
            {sent ? (
              <div className="w-full space-y-4">
                <div className="rounded-md border bg-muted/60 p-3 text-sm text-muted-foreground">
                  If an account exists for that email, a reset link has been
                  sent. Check your inbox and spam folder.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Send another link
                </Button>
                <Link
                  href="/login"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to login
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 w-full max-w-md"
              >
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  required
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link
                  href="/login"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to login
                </Link>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </ExternalLayout>
  );
}
