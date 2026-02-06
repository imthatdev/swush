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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const buildShortcuts = (isMac: boolean) => {
  const primary = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";

  return [
    { keys: [primary, "K"], desc: "Global search" },
    { keys: [primary, alt, "U"], desc: "Upload file" },
    { keys: [primary, alt, "N"], desc: "New note" },
    { keys: [primary, alt, "S"], desc: "New snippet" },
    { keys: [primary, alt, "B"], desc: "New bookmark" },
    { keys: ["Shift", "?"], desc: "Keyboard shortcuts" },
    { keys: ["Esc"], desc: "Close dialogs" },
  ];
};

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isQuestion = e.key === "?" || (e.shiftKey && e.key === "/");
      if (isQuestion) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const win = window as typeof window & {
      __swushQuickShortcutsBound?: boolean;
    };
    if (win.__swushQuickShortcutsBound) return;
    win.__swushQuickShortcutsBound = true;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modOk = isMac ? e.metaKey : e.ctrlKey;
      if (!modOk || !e.altKey) return;

      if (e.code === "KeyU") {
        e.preventDefault();
        setOpen(false);
        router.push("/upload");
        return;
      }
      if (e.code === "KeyN") {
        e.preventDefault();
        setOpen(false);
        router.push("/notes?new=1");
        return;
      }
      if (e.code === "KeyS") {
        e.preventDefault();
        setOpen(false);
        router.push("/snippets?new=1");
        return;
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        setOpen(false);
        router.push("/bookmarks?new=1");
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      win.__swushQuickShortcutsBound = false;
    };
  }, [router]);

  const rows = useMemo(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return buildShortcuts(isMac);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {rows.map((row) => (
            <div
              key={`${row.keys.join("+")}-${row.desc}`}
              className="flex items-center justify-between"
            >
              <div className="text-muted-foreground">{row.desc}</div>
              <div className="flex items-center gap-1">
                {row.keys.map((k) => (
                  <Badge key={k} variant="outline">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
