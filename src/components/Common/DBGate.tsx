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

import { IconDatabaseOff } from "@tabler/icons-react";
import { assertDB, DBDownError } from "@/lib/security/db-guard";
import ExternalLayout from "./ExternalLayout";

export default async function DBGate({
  children,
  assertDB: customAssertDB,
}: {
  children: React.ReactNode;
  assertDB?: (timeout?: number) => Promise<void>;
}) {
  let dbDown = false;
  let error: unknown = null;

  const check = customAssertDB || assertDB;

  try {
    await check(300);
  } catch (e) {
    error = e;
    if (e instanceof DBDownError) dbDown = true;
  }

  if (dbDown) {
    return (
      <ExternalLayout>
        <section className="w-full max-w-xl rounded-2xl border bg-background/60 p-8 shadow-lg backdrop-blur">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <IconDatabaseOff className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">We’ll be right back</h1>
            <p className="mt-2 text-muted-foreground">
              The site is temporarily unavailable while we sort something out.
              Your files and data are safe.
            </p>
          </div>
        </section>
      </ExternalLayout>
    );
  }

  if (error) throw error;
  return <>{children}</>;
}
