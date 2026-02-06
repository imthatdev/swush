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

import {
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandGoogle,
  IconLink,
} from "@tabler/icons-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { SocialProvider } from "@/lib/auth/social-config";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

type AccountItem = {
  id?: string;
  accountId?: string;
  providerId?: string;
};

const providerMeta: Record<
  SocialProvider,
  { label: string; icon: React.ReactNode }
> = {
  google: { label: "Google", icon: <IconBrandGoogle className="h-4 w-4" /> },
  github: { label: "GitHub", icon: <IconBrandGithub className="h-4 w-4" /> },
  discord: {
    label: "Discord",
    icon: <IconBrandDiscord className="h-4 w-4" />,
  },
};

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

export default function SocialAccountsManager() {
  const { socialLoginEnabled, socialLoginProviders } = useAppConfig();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const refreshAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        toast.error(error.message || "Failed to load linked accounts");
        return;
      }
      setAccounts((data as AccountItem[]) || []);
    } catch {
      toast.error("Failed to load linked accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAccounts();
  }, []);

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => !isCredentialProvider(a.providerId)),
    [accounts],
  );

  const linkedProviders = useMemo(
    () => new Set(accounts.map((a) => a.providerId).filter(Boolean)),
    [accounts],
  );

  const toProviderKey = (providerId?: string) => {
    if (!providerId) return null;
    const value = providerId.toLowerCase();
    if (value.includes("google")) return "google" as const;
    if (value.includes("github")) return "github" as const;
    if (value.includes("discord")) return "discord" as const;
    return null;
  };

  const linkProvider = async (provider: SocialProvider) => {
    if (!socialLoginEnabled) return;
    await authClient.linkSocial({
      provider,
      callbackURL: "/settings",
    });
  };

  const unlinkProvider = async (providerId?: string, accountId?: string) => {
    if (!providerId) return;
    try {
      const { error } = await authClient.unlinkAccount({
        providerId,
        accountId,
      });
      if (error) {
        toast.error(error.message || "Failed to unlink account");
        return;
      }
      toast.success("Account unlinked");
      await refreshAccounts();
    } catch {
      toast.error("Failed to unlink account");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {visibleAccounts.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No linked accounts.</p>
        ) : (
          visibleAccounts.map((account) => {
            const providerKey = toProviderKey(account.providerId);
            const meta = providerKey ? providerMeta[providerKey] : null;
            return (
              <div
                key={`${account.providerId}-${account.accountId}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{meta?.icon}</span>
                  <p className="text-foreground font-semibold">
                    {meta?.label ?? account.providerId ?? "Unknown"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void unlinkProvider(account.providerId, account.accountId)
                  }
                >
                  Unlink
                </Button>
              </div>
            );
          })
        )}
      </div>

      {socialLoginEnabled && socialLoginProviders.length > 0 && (
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2">
              <IconLink className="h-4 w-4" />
              Link social
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link a social account</DialogTitle>
              <DialogDescription>
                Choose a provider to link with this account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {socialLoginProviders.map((provider) => (
                <Button
                  key={provider}
                  variant="secondary"
                  onClick={() => void linkProvider(provider)}
                  disabled={linkedProviders.has(provider)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    {providerMeta[provider].icon}
                    {providerMeta[provider].label}
                  </span>
                  {linkedProviders.has(provider) ? "Linked" : "Link"}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
