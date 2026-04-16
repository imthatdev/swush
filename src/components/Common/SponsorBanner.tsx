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
import { IconBolt, IconHeart, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import { useLocalStorageNumber } from "@/hooks/use-local-storage";

const STORAGE_KEY = "swush:sponsor-banner:last";
const COOLDOWN_MS = 1000 * 60 * 60 * 8;
const RANDOM_CHANCE = 0.25;

export default function SponsorBanner() {
  const { sponsorBannerEnabled } = useAppConfig();
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
    sponsorBannerEnabled &&
    !dismissed &&
    now - lastShown > COOLDOWN_MS &&
    roll <= RANDOM_CHANCE;

  if (!shouldShow) return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-linear-to-r from-primary/12 via-primary/8 to-background/80 p-4 text-sm shadow-sm">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <IconBolt className="h-4 w-4" />
            </span>
            <div className="font-semibold text-foreground">
              Keep Swush fast, independent, and shipping.
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your sponsorship helps cover infrastructure, my mental (hehe),
            bug-fixes, and new features.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="rounded-2xl">
            <a href={sponsorUrl} target="_blank" rel="noreferrer noopener">
              <IconHeart className="h-4 w-4" />
              Sponsor Swush
            </a>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-2xl"
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
