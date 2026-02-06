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
import * as React from "react";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
  className?: string;
  headerActionsClassName?: string;
}

export default function PageLayout({
  title,
  subtitle,
  headerActions,
  toolbar,
  children,
  maxWidthClassName = "max-w-full",
  headerActionsClassName,
  className,
}: PageLayoutProps) {
  return (
    <main
      className={cn("flex-1 p-2 overflow-auto h-[90svh] md:h-full ", className)}
    >
      <div className={cn("mx-auto space-y-2 md:space-y-4", maxWidthClassName)}>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            headerActionsClassName,
          )}
        >
          <div>
            <h1 className="text-base md:text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {headerActions ? (
            <div className="flex gap-2 items-center">{headerActions}</div>
          ) : null}
        </div>
        <Separator className="md:hidden" />
        {toolbar ? (
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            {toolbar}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
