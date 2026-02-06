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

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/client/api-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = getErrorMessage(error, "Something went wrong.");

  return (
    <html>
      <body>
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-xl text-center space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              If this keeps happening, please contact support.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => reset()}>Try again</Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
