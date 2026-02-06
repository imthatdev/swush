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

import { useEffect, useState } from "react";

type Params = Promise<{ linked?: string; error?: string }>;

export default function AniListLinkedPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const [status, setStatus] = useState<"success" | "error" | "pending">(
    "pending"
  );

  useEffect(() => {
    searchParams.then(({ linked, error }) => {
      const ok = linked === "1" && !error;
      setStatus(ok ? "success" : "error");

      if (window.opener) {
        window.opener.postMessage(
          {
            type: "anilistLinked",
            success: ok,
            error: error || null,
          },
          window.location.origin
        );
        window.close();
      }
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {status === "pending"
          ? "Finishing AniList linking…"
          : "You can close this window."}
      </p>
    </div>
  );
}
