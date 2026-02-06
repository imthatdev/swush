/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swush",
    short_name: "Swush",
    description:
      "A secure, self-hosted file sharing app with privacy-first features.",
    id: "/",
    scope: "/",
    start_url: "/vault",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#8B5FAA",
    icons: [
      {
        src: "/images/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/images/icons/apple-touch-icon.png",
        sizes: "750x750",
        type: "image/png",
      },
      {
        src: "/images/icons/apple-touch-icon-precomposed.png",
        sizes: "750x750",
        type: "image/png",
      },
      {
        src: "/images/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
