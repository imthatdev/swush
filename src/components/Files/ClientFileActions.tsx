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
import { IconCopy, IconDownload, IconEye } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CopyButton from "@/components/Common/CopyButton";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";

type Props = {
  viewUrl: string;
  rawUrl: string;
  downloadName: string;
  password?: string;
  onPreview?: () => void;
  canPreview?: boolean;
};

export default function ClientFileActions({
  viewUrl,
  rawUrl,
  downloadName,
  password,
  onPreview,
  canPreview,
}: Props) {
  const { appUrl } = useAppConfig();
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : appUrl || "";
  const downloadHref = password
    ? `${rawUrl}?p=${encodeURIComponent(password)}`
    : rawUrl;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      {canPreview && onPreview && (
        <Button
          className="gap-2 rounded-full px-5 py-3 shadow-sm"
          onClick={onPreview}
        >
          <IconEye />
          <span>Preview</span>
        </Button>
      )}
      <Button asChild className="gap-2 rounded-full px-5 py-3 shadow-sm">
        <a
          href={downloadHref}
          download={downloadName}
          onClick={() => toast.success(`Download starting… ${downloadName}`)}
        >
          <IconDownload />
          <span>Download</span>
        </a>
      </Button>
      <CopyButton
        variant="outline"
        className="gap-2 rounded-full px-5 shadow-sm"
        successMessage="Page link copied"
        showCopiedText
        getText={() => {
          const url = new URL(viewUrl, baseUrl);
          if (password) {
            url.searchParams.set("p", password);
          }
          const raw = url.toString();
          return raw;
        }}
      >
        <IconCopy />
        <span>Copy View</span>
      </CopyButton>
      <CopyButton
        variant="outline"
        className="gap-2 rounded-full px-5 shadow-sm"
        successMessage="Raw link copied"
        getText={() => {
          const url = new URL(rawUrl, baseUrl);
          if (password) {
            url.searchParams.set("p", password);
          }
          return url.toString();
        }}
      >
        <IconCopy />
        <span>Copy Raw</span>
      </CopyButton>
    </div>
  );
}
