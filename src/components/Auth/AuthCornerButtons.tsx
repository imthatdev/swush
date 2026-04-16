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

import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import ThemeButton from "@/components/Common/ThemeButton";
import { IconChevronLeft, IconLayoutDashboardFilled } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

export default function AuthCornerButtons() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <>
      <span className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <Button
          size="icon"
          className="rounded-2xl"
          variant="secondary"
          onClick={() => router.push("/")}
        >
          <IconChevronLeft />
        </Button>
        {user ? (
          <Button
            className="rounded-2xl"
            variant="default"
            onClick={() => router.push("/vault")}
          >
            <IconLayoutDashboardFilled />
            Dashboard
          </Button>
        ) : null}
      </span>
      <span className="absolute right-4 top-4 z-20">
        <ThemeButton />
      </span>
    </>
  );
}
