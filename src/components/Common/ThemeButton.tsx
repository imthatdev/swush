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
import { IconPaletteFilled } from "@tabler/icons-react";
import React, { useState } from "react";
import { Button } from "../ui/button";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "../ui/label";
import { useColorScheme } from "@/hooks/use-scheme";

export default function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const { scheme, setScheme, SCHEMES, SCHEMES_PREVIEW } = useColorScheme();

  const [schemeDialogOpen, setSchemeDialogOpen] = useState(false);
  const [pendingScheme, setPendingScheme] = useState(scheme);
  const [pendingMode, setPendingMode] = useState<string>(theme || "system");

  return (
    <>
      <Button size="icon" onClick={() => setSchemeDialogOpen(true)}>
        <IconPaletteFilled className="h-5 w-5" />
      </Button>

      <Dialog open={schemeDialogOpen} onOpenChange={setSchemeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Color scheme
              </Label>
              <Select
                value={pendingScheme}
                onValueChange={(v: string) => {
                  const next = v as (typeof SCHEMES)[number];
                  setPendingScheme(next);
                  setScheme(next);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder="Choose a scheme"
                    className="capitalize"
                  />
                </SelectTrigger>
                <SelectContent>
                  {SCHEMES.map((s) => {
                    const token = s as keyof typeof SCHEMES_PREVIEW;
                    const sw = SCHEMES_PREVIEW[token];
                    return (
                      <SelectItem key={s} value={s} className="capitalize">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-block h-3 w-7 rounded-sm border"
                            style={{
                              background: sw ?? "var(--primary)",
                              borderColor: "rgba(0,0,0,0.08)",
                            }}
                          />
                          <span className="capitalize">{s}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Appearance
              </Label>
              <Select
                value={pendingMode}
                onValueChange={(v) => {
                  setPendingMode(v);
                  setTheme(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="System / Light / Dark" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Schemes change the app colors; appearance controls light/dark.
              Both are saved.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
