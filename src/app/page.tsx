/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import { IconAlertCircle, IconBrandChrome } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/client/user";
import { Logo } from "@/components/Common/Logo";
import Link from "next/link";
import { getVersionInfo } from "@/lib/version";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import ExternalLayout from "@/components/Common/ExternalLayout";

export default async function Home() {
  const session = await getCurrentSession();
  const { supportEmail } = await getPublicRuntimeSettings();

  const { currentVersion, latestVersion, updateAvailable } =
    await getVersionInfo();

  return (
    <ExternalLayout>
      <div className="max-w-2xl text-center space-y-6 pt-10">
        <div className="flex flex-col md:flex-row items-center gap-1 text-4xl sm:text-5xl">
          <span>Welcome to</span>
          <Logo size={56} textClassName="text-4xl sm:text-5xl" />
        </div>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
          Secure. Private. Share files with confidence. <br />
          Self-hosted simplicity meets powerful privacy.
        </p>
        <div className="flex gap-4 justify-center flex-col sm:flex-row">
          {session ? (
            <Button href="/vault">Go to Dashboard</Button>
          ) : (
            <Button href="/login">Login</Button>
          )}
          <Button asChild variant="outline" className="gap-1">
            <a
              href="https://chromewebstore.google.com/detail/jgipkeccibhgdfhoknfggljdmdodkjop?utm_source=item-share-cb"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Install Swush Companion for Chrome"
            >
              <IconBrandChrome size={18} /> Chrome Extension
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Need help?{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="underline hover:text-primary"
          >
            Contact support
          </a>
        </p>
      </div>

      <section className="mt-20 max-w-5xl w-full px-4">
        <h2 className="text-3xl font-semibold text-center mb-10">Why Swush?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-lg border p-6 bg-card">
            <h3 className="font-medium mb-2">⚡ Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">
              Experience fast uploads.
            </p>
          </div>
          <div className="rounded-lg border p-6 bg-card">
            <h3 className="font-medium mb-2">🛡️ Advanced Security</h3>
            <p className="text-sm text-muted-foreground">
              Built-in 2FA and secure session management keep accounts safe.
            </p>
          </div>
          <div className="rounded-lg border p-6 bg-card">
            <h3 className="font-medium mb-2">🖥️ Self-Hosted</h3>
            <p className="text-sm text-muted-foreground">
              Own your data with a 100% self-hosted and open-source platform.
            </p>
          </div>
          <div className="rounded-lg border p-6 bg-card">
            <h3 className="font-medium mb-2">🎯 Smart Access</h3>
            <p className="text-sm text-muted-foreground">
              Role-based access control and expiring links give you precision.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex gap-4">
        <Link
          href="/terms"
          className="underline text-sm text-muted-foreground hover:text-primary text-center order-2 md:order-1"
        >
          Terms of Service
        </Link>

        <Link
          href="/privacy"
          className="underline text-sm text-muted-foreground hover:text-primary text-center order-1 md:order-3"
        >
          Privacy Policy
        </Link>
      </div>

      <div className="mt-4 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <span>
            Version <span className="font-mono">v{currentVersion}</span>
          </span>
          {/* TODO: Handle versioning later */}
          {updateAvailable && latestVersion ? (
            <Link
              href="https://github.com/imthatdev/swush-ce/releases/latest"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded border px-2 bg-destructive text-primary-foreground py-0.5 hover:bg-accent"
            >
              <IconAlertCircle size={14} /> Update available (v{latestVersion})
            </Link>
          ) : null}
        </div>
      </div>
    </ExternalLayout>
  );
}
