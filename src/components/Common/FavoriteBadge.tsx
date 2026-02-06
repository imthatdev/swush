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

import { IconStarFilled, IconStar, IconLoader2 } from "@tabler/icons-react";
import { Button } from "../ui/button";

export default function FavoriteBadge({
  isFavorite,
  toggleFavorite,
  loading = false,
}: {
  isFavorite: boolean;
  toggleFavorite?: () => void;
  loading?: boolean;
}) {
  const isDisabled = loading || !toggleFavorite;
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleFavorite}
      disabled={isDisabled}
    >
      {isFavorite ? (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-2 text-xs font-medium">
            {loading ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconStarFilled size={14} />
            )}
          </span>
        </div>
      ) : (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-2 text-xs font-medium">
            {loading ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconStar size={14} />
            )}
          </span>
        </div>
      )}
    </Button>
  );
}
