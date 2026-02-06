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

import { useState } from "react";
import type { Summary } from "@/components/Upload/types";

export function useUploadSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [maxUploadMb, setMaxUploadMb] = useState<number | null>(null);
  const [maxFilesPerUpload, setMaxFilesPerUpload] = useState<number | null>(
    null,
  );
  const [remainingQuotaMb, setRemainingQuotaMb] = useState<number | null>(null);
  const [filesRemaining, setFilesRemaining] = useState<number | null>(null);
  const [maxStorageMb, setMaxStorageMb] = useState<number | null>(null);
  const [remainingStorageMb, setRemainingStorageMb] = useState<number | null>(
    null,
  );
  const [usedTodayBytes, setUsedTodayBytes] = useState<number>(0);
  const [usedStorageBytes, setUsedStorageBytes] = useState<number>(0);
  const [allowRemoteUpload, setAllowRemoteUpload] = useState<boolean>(false);

  const apply = (data: Summary) => {
    setSummary(data);

    setMaxUploadMb(data.perUpload.maxUploadMb ?? null);
    setMaxFilesPerUpload(data.perUpload.maxFilesPerUpload ?? null);

    const remainingToday =
      typeof data.dailyQuota.remainingTodayMb === "number"
        ? data.dailyQuota.remainingTodayMb
        : null;
    setRemainingQuotaMb(remainingToday);

    const filesRem =
      data.resources.files.remaining === Infinity
        ? null
        : (data.resources.files.remaining as number);
    setFilesRemaining(filesRem);

    const maxStore =
      typeof data.storage.maxStorageMb === "number"
        ? data.storage.maxStorageMb
        : null;
    setMaxStorageMb(maxStore);

    const remStore =
      typeof data.storage.remainingStorageMb === "number"
        ? data.storage.remainingStorageMb
        : null;

    setRemainingStorageMb(remStore);

    setUsedTodayBytes(
      Math.max(0, Math.floor((data.dailyQuota.usedTodayMb || 0) * 1_000_000)),
    );
    setUsedStorageBytes(
      Math.max(0, Math.floor((data.storage.usedStorageMb || 0) * 1_000_000)),
    );

    setAllowRemoteUpload(data.features.remoteUpload);
  };

  return {
    summary,
    setSummary,
    maxUploadMb,
    setMaxUploadMb,
    maxFilesPerUpload,
    setMaxFilesPerUpload,
    remainingQuotaMb,
    setRemainingQuotaMb,
    filesRemaining,
    setFilesRemaining,
    maxStorageMb,
    setMaxStorageMb,
    remainingStorageMb,
    setRemainingStorageMb,
    usedTodayBytes,
    setUsedTodayBytes,
    usedStorageBytes,
    setUsedStorageBytes,
    allowRemoteUpload,
    setAllowRemoteUpload,
    apply,
  };
}
