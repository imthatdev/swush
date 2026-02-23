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

export type SwushAudioGraph = {
  ctx: AudioContext;
  source: AudioNode;
  gain: GainNode | null;
};

export const AUDIO_GRAPH_EVENT = "swush-audio-graph";

const audioGraphMap = new WeakMap<HTMLMediaElement, SwushAudioGraph>();

export function registerAudioGraph(
  el: HTMLMediaElement | null,
  graph: SwushAudioGraph | null,
) {
  if (!el) return;
  if (graph) {
    audioGraphMap.set(el, graph);
  } else {
    audioGraphMap.delete(el);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUDIO_GRAPH_EVENT, {
        detail: { element: el, ready: Boolean(graph) },
      }),
    );
  }
}

export function getAudioGraph(el: HTMLMediaElement | null) {
  if (!el) return null;
  return audioGraphMap.get(el) ?? null;
}
