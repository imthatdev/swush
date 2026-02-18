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
    title: "Terms of Service",
    description: "Terms of Service for Swush.",
  };
}

export default function TermsPage() {
  return (
    <ExternalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: 2026-01-01
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Swush is a self-hosted app for private file sharing and content
            management. These terms apply to all users of this instance. By
            using the app, you agree to follow these terms and any instance
            specific rules set by the administrator.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Account responsibilities</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>Provide accurate account details and keep them updated.</li>
            <li>Keep your credentials secure and do not share your account.</li>
            <li>You are responsible for activity under your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acceptable use</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>Do not upload content that is illegal or infringes rights.</li>
            <li>Do not attempt to break, scan, or abuse the service.</li>
            <li>Do not attempt to bypass rate limits or storage limits.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Service operation</h2>
          <p className="text-sm text-muted-foreground">
            The administrator can adjust storage limits, rate limits, or
            features at any time. Planned maintenance or interruptions may occur
            to keep the service healthy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Content ownership</h2>
          <p className="text-sm text-muted-foreground">
            You retain ownership of your content. You grant the service the
            minimum rights needed to store, process, and serve your content to
            you and your intended recipients.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Account deletion</h2>
          <p className="text-sm text-muted-foreground">
            You can request deletion of your account within the app. When
            deleted, your content and account data are removed from this
            instance, subject to any retention needed for operational or legal
            reasons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Administrator access</h2>
          <p className="text-sm text-muted-foreground">
            This instance is managed by an administrator who may access
            operational data, logs, or storage to maintain the service or comply
            with law. Do not store content you do not wish the administrator to
            control.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="text-sm text-muted-foreground">
            These terms may be updated. Continued use after changes means you
            accept the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-muted-foreground">
            For questions, contact the administrator of this Swush instance.
          </p>
        </section>
      </div>
    </ExternalLayout>
  );
}
