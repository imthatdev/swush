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
import { copyToClipboard } from "@/lib/client/clipboard";
import { toast } from "sonner";
import type { ComponentProps, ReactNode } from "react";

type CopyButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  text?: string;
  getText?: () => string | Promise<string>;
  successMessage?: string;
  successDescription?: string | ((text: string) => string);
  errorMessage?: string;
  showCopiedText?: boolean;
  onCopied?: (text: string) => void;
  onClick?: ComponentProps<typeof Button>["onClick"];
  children: ReactNode;
};

export default function CopyButton({
  text,
  getText,
  successMessage = "Copied",
  successDescription,
  errorMessage = "Copy failed",
  showCopiedText = false,
  onCopied,
  children,
  onClick,
  ...props
}: CopyButtonProps) {
  const handleClick: NonNullable<CopyButtonProps["onClick"]> = async (e) => {
    onClick?.(e);
    try {
      const value =
        typeof getText === "function" ? await getText() : (text ?? "");
      if (!value) throw new Error("Nothing to copy");
      await copyToClipboard(value);
      const description =
        typeof successDescription === "function"
          ? successDescription(value)
          : successDescription || (showCopiedText ? value : undefined);
      toast.success(successMessage, description ? { description } : undefined);
      onCopied?.(value);
    } catch (err) {
      toast.error(errorMessage, {
        description: (err as Error)?.message || "Clipboard unavailable",
      });
    }
  };

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}
