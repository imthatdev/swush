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

import { IconLoader2, IconLock, IconLockOpen } from "@tabler/icons-react";

import { Button } from "../ui/button";

export default function PublicBadge({
  isPublic,
  toggleVisibility,
  loading = false,
  disabled = false,
}: {
  isPublic: boolean;
  toggleVisibility?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading || !toggleVisibility;
  return (
    <Button
      variant="ghost"
      onClick={toggleVisibility}
      disabled={isDisabled}
      size="icon"
    >
      {isPublic ? (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-2 text-xs font-medium">
            {loading ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconLockOpen size={14} />
            )}
          </span>
        </div>
      ) : (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-2 py-2 text-xs font-medium">
            {loading ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconLock size={14} />
            )}
          </span>
        </div>
      )}
    </Button>
  );
}
