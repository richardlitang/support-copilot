export type PipelineAccent = {
  text: string;
  ring: string;
  surface: string;
};

export function pipelineStepAccent(status: string): PipelineAccent {
  if (status === "complete") {
    return { text: "text-sage", ring: "border-sage/30", surface: "bg-sage/5" };
  }
  if (status === "blocked") {
    return { text: "text-ember", ring: "border-ember/30", surface: "bg-ember/5" };
  }
  if (status === "skipped") {
    return { text: "text-zinc-400", ring: "border-zinc-200", surface: "bg-parchment/40" };
  }
  return { text: "text-signal", ring: "border-signal/30", surface: "bg-signal/5" };
}

export function isStepRevealed(index: number, playhead: number): boolean {
  return index < playhead;
}
