"use client";

import { useEffect, useRef, useState } from "react";

// NGL is WebGL/browser-only and references `window`, so it is imported lazily
// inside the effect (never at module scope) to stay clear of SSR.

// AlphaFold's own pLDDT confidence bands, reused verbatim for credibility.
const PLDDT_BANDS = [
  { min: 90, color: 0x0053d6, label: "Very high (90–100)" },
  { min: 70, color: 0x65cbf3, label: "Confident (70–90)" },
  { min: 50, color: 0xffdb13, label: "Low (50–70)" },
  { min: 0, color: 0xff7d45, label: "Very low (<50)" },
];

let schemeRegistered: string | null = null;

export interface StructureViewerProps {
  pdb: string;
  /** 1-indexed residue positions to emphasise (e.g. mutated residues). */
  highlight?: number[];
  className?: string;
}

export function StructureViewer({
  pdb,
  highlight = [],
  className = "",
}: StructureViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stage: any = null;
    let disposed = false;

    (async () => {
      try {
        const NGL = await import("ngl");
        if (disposed || !hostRef.current) return;

        // Register the pLDDT colour scheme once per session.
        if (!schemeRegistered) {
          schemeRegistered = NGL.ColormakerRegistry.addScheme(function (
            this: any,
          ) {
            this.atomColor = (atom: any) => {
              const b = atom.bfactor;
              for (const band of PLDDT_BANDS) {
                if (b >= band.min) return band.color;
              }
              return 0xff7d45;
            };
          });
        }

        stage = new NGL.Stage(hostRef.current, {
          backgroundColor: "white",
        });

        const blob = new Blob([pdb], { type: "text/plain" });
        const comp = await stage.loadFile(blob, { ext: "pdb" });
        if (disposed) return;

        comp.addRepresentation("cartoon", { colorScheme: schemeRegistered });

        if (highlight.length > 0) {
          const sele = highlight.map((p) => `${p}`).join(" or ");
          comp.addRepresentation("ball+stick", {
            sele,
            color: 0xe5308a,
            aspectRatio: 1.6,
            radiusScale: 1.4,
          });
        }

        comp.autoView();
        setStatus("ready");
      } catch (err) {
        if (disposed) return;
        setMessage(
          err instanceof Error ? err.message : "Could not render structure.",
        );
        setStatus("error");
      }
    })();

    const onResize = () => stage?.handleResize?.();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      stage?.dispose?.();
    };
  }, [pdb, highlight]);

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center bg-slate-50/80 text-sm text-slate-500">
          {status === "loading" ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-signal-500" />
              Rendering structure…
            </span>
          ) : (
            <span className="max-w-xs px-4 text-center text-red-600">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { PLDDT_BANDS };
