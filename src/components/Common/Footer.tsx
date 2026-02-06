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

"use client";

import { IconCoffee, IconHeart } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Tooltip } from "../Shared/CustomTooltip";

export default function Footer() {
  const visitDeveloper = () => {
    window.open("https://iconical.dev", "_blank");
  };
  return (
    <footer className="border-t py-4 flex justify-center items-center">
      <div className="order-1 md:order-3">
        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="flex gap-3 mt-2">
            <Tooltip Content="Sponsor Swush" side="top">
              <Link
                href="https://iconical.dev/sponsor"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">
                  <IconHeart size={18} className="inline" />
                </Button>
              </Link>
            </Tooltip>
            <Tooltip Content="Buy me a coffee" side="top">
              <Link
                href="https://www.buymeacoffee.com/iconical"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">
                  <IconCoffee size={18} className="inline" />
                </Button>
              </Link>
            </Tooltip>
          </div>
        </div>
        <div
          className="text-center text-xs text-muted-foreground hover:cursor-pointer hover:text-primary"
          onClick={visitDeveloper}
        >
          © {new Date().getFullYear()} Swush (Iconical).
          <br />
          All rights reserved.
        </div>
      </div>
    </footer>
  );
}
