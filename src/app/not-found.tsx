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

import { IconHome, IconEyeSearch } from "@tabler/icons-react";
import ExternalLayout from "@/components/Common/ExternalLayout";
import Link from "next/link";

export default function NotFound() {
  return (
    <ExternalLayout>
      <section className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-background/60 p-8 shadow-lg backdrop-blur">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl ring-1 ring-border/40" />
        <div className="pointer-events-none absolute -inset-1 -z-20 bg-linear-to-b from-primary/20 via-transparent to-transparent blur-2xl" />

        <div className="flex items-start gap-4">
          <div className="mt-1 rounded-xl bg-primary/10 p-3">
            <IconEyeSearch className="h-6 w-6 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="bg-linear-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Not Found
              </span>
            </h1>
            <p className="text-muted-foreground">
              We couldn’t find the resource you’re looking for. It may have been
              moved, deleted, or set to private.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/vault"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
          >
            <IconHome className="mr-2 h-4 w-4" />
            Return home
          </Link>
        </div>

        <div className="mt-6 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Tip: If this should be public, check its visibility from your
          dashboard.
        </div>
      </section>
    </ExternalLayout>
  );
}
