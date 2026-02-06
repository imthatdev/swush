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

import { useMemo, useState } from "react";
import { IconBolt, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useLocalStorageNumber } from "@/hooks/use-local-storage";

const STORAGE_KEY = "swush:sponsor-banner:last";
const COOLDOWN_MS = 1000 * 60 * 60 * 8;
const RANDOM_CHANCE = 0.25;

export default function SponsorBanner() {
  const [lastShown, setLastShown] = useLocalStorageNumber(STORAGE_KEY, 0);
  const [dismissed, setDismissed] = useState(false);
  const [roll] = useState(() => Math.random());
  const [now] = useState(() => Date.now());

  const handleDismiss = () => {
    setLastShown(Date.now());
    setDismissed(true);
  };

  const sponsorUrl = useMemo(() => "https://iconical.dev/sponsor", []);

  const shouldShow =
    !dismissed && now - lastShown > COOLDOWN_MS && roll <= RANDOM_CHANCE;

  if (!shouldShow) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconBolt className="h-4 w-4" />
          </span>
          <div>
            <div className="font-medium text-foreground">Sponsor Swush</div>
            <div className="text-xs text-muted-foreground">
              Help keep development moving with a small sponsorship.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <a href={sponsorUrl} target="_blank" rel="noreferrer noopener">
              Sponsor
            </a>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleDismiss}
            aria-label="Dismiss sponsor banner"
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
