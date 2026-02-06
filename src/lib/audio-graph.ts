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
