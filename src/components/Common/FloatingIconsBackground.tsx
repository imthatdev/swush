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

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  IconBookmark,
  IconCloud,
  IconFileText,
  IconFolder,
  IconLink,
  IconPhoto,
  IconStar,
} from "@tabler/icons-react";

type FloatingSeed = {
  id: number;
  iconIndex: number;
  x: number;
  y: number;
  drift: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
  blur: number;
  rotate: number;
  spin: number;
  travel: number;
};

const floatingIconComponents = [
  IconLink,
  IconFileText,
  IconBookmark,
  IconFolder,
  IconCloud,
  IconPhoto,
  IconStar,
] as const;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createFloatingSeeds(count: number, seed: number) {
  const random = mulberry32(seed);
  return Array.from(
    { length: count },
    (_, id) =>
      ({
        id,
        iconIndex: Math.floor(random() * floatingIconComponents.length),
        x: random() * 100,
        y: random() * 120 - 10,
        drift: (random() - 0.5) * 34,
        duration: 16 + random() * 20,
        delay: random() * 8,
        size: 16 + random() * 24,
        opacity: 0.035 + random() * 0.08,
        blur: random() * 2.2,
        rotate: random() * 360,
        spin: (random() - 0.5) * 84,
        travel: 120 + random() * 220,
      }) satisfies FloatingSeed,
  );
}

export default function FloatingIconsBackground({
  seed = 124771,
  count = 30,
  className = "pointer-events-none absolute inset-0 z-0 overflow-hidden",
  iconClassName = "text-primary",
  iconGlyphClassName,
}: {
  seed?: number;
  count?: number;
  className?: string;
  iconClassName?: string;
  iconGlyphClassName?: string;
}) {
  const seeds = useMemo(() => createFloatingSeeds(count, seed), [count, seed]);
  const glyphClassName = iconGlyphClassName ?? iconClassName;

  return (
    <div className={className}>
      {seeds.map((seedConfig) => {
        const Icon = floatingIconComponents[seedConfig.iconIndex];

        return (
          <motion.div
            key={seedConfig.id}
            className={`absolute ${iconClassName}`}
            style={{
              left: `${seedConfig.x}%`,
              top: `${seedConfig.y}%`,
              width: `${seedConfig.size}px`,
              height: `${seedConfig.size}px`,
              filter: `blur(${seedConfig.blur}px)`,
              opacity: seedConfig.opacity,
            }}
            animate={{
              y: [0, -seedConfig.travel],
              x: [0, seedConfig.drift, -seedConfig.drift * 0.75, 0],
              rotate: [seedConfig.rotate, seedConfig.rotate + seedConfig.spin],
            }}
            transition={{
              duration: seedConfig.duration,
              delay: seedConfig.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Icon
              className={`h-full w-full ${glyphClassName}`.trim()}
              stroke={1.5}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
