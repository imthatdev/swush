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

import ExternalLayout from "@/components/Common/ExternalLayout";
import { getDefaultMetadata } from "@/lib/head";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "Privacy Policy",
    description: "Privacy Policy for Swush.",
  };
}

export default function PrivacyPage() {
  return (
    <ExternalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: 2026-01-01
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What this app does</h2>
          <p className="text-sm text-muted-foreground">
            Swush is a self-hosted vault for files and short links. Your data is
            stored on the server that hosts this instance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Data we collect</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>
              Account data: email, username, password hash, and profile info.
            </li>
            <li>Content data: files and metadata you upload or create.</li>
            <li>Operational data: IP address, user agent, and audit logs.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How data is used</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>To authenticate you and keep your account secure.</li>
            <li>To store and deliver your content.</li>
            <li>To prevent abuse and monitor system health.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Storage and encryption</h2>
          <p className="text-sm text-muted-foreground">
            Files are stored in local storage or S3-compatible storage depending
            on server configuration. Storage credentials are encrypted in the
            database. Uploaded files are not end-to-end encrypted by default.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sharing and public links</h2>
          <p className="text-sm text-muted-foreground">
            If you mark content as public or share a direct link, anyone with
            the link can access it. You are responsible for what you share.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Account deletion</h2>
          <p className="text-sm text-muted-foreground">
            You can delete your account from the settings page. Deletion removes
            your account data and content from this instance, subject to any
            required retention for operational or legal reasons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Cookies and sessions</h2>
          <p className="text-sm text-muted-foreground">
            We use cookies or tokens to keep you signed in and to secure API
            requests. These are required for the app to function.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Administrator access</h2>
          <p className="text-sm text-muted-foreground">
            This instance is controlled by an administrator who can access
            operational data, logs, and stored content to maintain or enforce
            rules. Contact the administrator for questions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="text-sm text-muted-foreground">
            We may update this policy. Continued use after changes means you
            accept the updated policy.
          </p>
        </section>
      </div>
    </ExternalLayout>
  );
}
