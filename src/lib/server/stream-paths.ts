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

import "server-only";

const HLS_PLAYLIST = "index.m3u8";

export function streamStoredPrefix(fileId: string) {
  return `streams/${fileId}`;
}

export function streamAssetStoredName(fileId: string, asset: string) {
  return `${streamStoredPrefix(fileId)}/${asset}`;
}

export function streamPlaylistName() {
  return HLS_PLAYLIST;
}
