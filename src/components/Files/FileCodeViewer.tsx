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
import { useEffect, useRef, useState } from "react";
import {
  formatLanguageLabel,
  registerAndHighlight,
  detectLanguage,
} from "@/lib/code";
import CopyButton from "../Common/CopyButton";
import { IconClipboard } from "@tabler/icons-react";

interface FileCodeViewerProps {
  filename: string;
  content: string | null;
  loading?: boolean;
}

export function FileCodeViewer({
  filename,
  content,
  loading,
}: FileCodeViewerProps) {
  const codeRef = useRef<HTMLElement | null>(null);

  const language = detectLanguage(filename);

  const [precomputedWidths] = useState(() =>
    Array.from({ length: 10 }, () => 80 + Math.random() * 20),
  );

  useEffect(() => {
    if (!content || !codeRef.current) return;
    codeRef.current.textContent = content;
    registerAndHighlight(codeRef.current, content, language).catch(() => {
      codeRef.current!.textContent = content;
      codeRef.current!.removeAttribute("data-highlighted");
    });
  }, [content, filename, language]);

  return (
    <div className="mt-3 rounded-lg border bg-muted/40 overflow-hidden w-full">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {formatLanguageLabel(language)}
          </span>
          <span>{content ? content.split("\n").length : 0} lines</span>
          <span>{content ? content.length : 0} chars</span>
        </div>
        <CopyButton
          variant="ghost"
          className="h-7 px-2"
          successMessage="Copied code to clipboard"
          getText={() => content || ""}
        >
          <IconClipboard className="h-4 w-4" />
          Copy
        </CopyButton>
      </div>
      {loading || content === null ? (
        <div className="p-3">
          {precomputedWidths.map((width, i) => (
            <div
              key={i}
              className="h-6 w-full mb-1 rounded bg-muted animate-pulse"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ) : (
        <pre className="max-h-80 overflow-auto text-[11px] md:text-xs leading-relaxed p-3">
          <code ref={codeRef} className={`hljs language-${language}`} />
        </pre>
      )}
    </div>
  );
}
