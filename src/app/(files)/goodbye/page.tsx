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
import { defaultMetadata } from "@/lib/head";
import Link from "next/link";

export const metadata = {
  title: "Goodbye",
  description: "Your account has been successfully deleted.",
  ...defaultMetadata,
};

export default function GoodbyePage() {
  return (
    <ExternalLayout>
      <div className="max-w-lg text-center space-y-3">
        <h1 className="text-2xl font-semibold">Your account is deleted</h1>
        <p className="text-sm text-muted-foreground">
          We’re sorry to see you go. If this was a mistake, please contact
          support.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm"
          >
            Return home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    </ExternalLayout>
  );
}
