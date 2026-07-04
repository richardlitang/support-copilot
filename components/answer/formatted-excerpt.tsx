import { getFormattedExcerptLines } from "@/lib/format-excerpt";

export function FormattedExcerpt({ excerpt }: { excerpt: string }) {
  const lines = getFormattedExcerptLines(excerpt);

  if (!lines.length) {
    return null;
  }

  return (
    <div className="mt-3">
      {lines.map((line, index) => {
        if (line.kind === "heading") {
          return (
            <p
              key={`${line.text}-${index}`}
              className="mt-2.5 first:mt-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500"
            >
              {line.text}
            </p>
          );
        }

        return (
          <p key={`${line.text}-${index}`} className="mt-1 text-sm leading-6 text-zinc-700">
            {line.kind === "bullet" ? <span className="mr-1.5 text-zinc-400">–</span> : null}
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
