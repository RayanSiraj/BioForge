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

// Standard amino acids: one-letter code, full name, and a concise, factual
// note on chemical character. This describes the residue *type* (established
// biochemistry) — it does NOT assert a per-position biological function, which
// structure alone cannot establish.
const AMINO_ACIDS: Record<string, { one: string; name: string; role: string }> =
  {
    ALA: { one: "A", name: "Alanine", role: "small, hydrophobic" },
    ARG: { one: "R", name: "Arginine", role: "positively charged, basic" },
    ASN: { one: "N", name: "Asparagine", role: "polar, amide side chain" },
    ASP: { one: "D", name: "Aspartate", role: "negatively charged, acidic" },
    CYS: { one: "C", name: "Cysteine", role: "thiol; forms disulfide bonds" },
    GLN: { one: "Q", name: "Glutamine", role: "polar, amide side chain" },
    GLU: { one: "E", name: "Glutamate", role: "negatively charged, acidic" },
    GLY: { one: "G", name: "Glycine", role: "smallest; adds backbone flexibility" },
    HIS: {
      one: "H",
      name: "Histidine",
      role: "aromatic, weakly basic; common catalytic residue",
    },
    ILE: { one: "I", name: "Isoleucine", role: "branched, hydrophobic" },
    LEU: { one: "L", name: "Leucine", role: "branched, hydrophobic" },
    LYS: { one: "K", name: "Lysine", role: "positively charged, basic" },
    MET: { one: "M", name: "Methionine", role: "hydrophobic; typical start residue" },
    PHE: { one: "F", name: "Phenylalanine", role: "aromatic, hydrophobic" },
    PRO: { one: "P", name: "Proline", role: "rigid ring; kinks the backbone" },
    SER: {
      one: "S",
      name: "Serine",
      role: "polar, nucleophilic hydroxyl; common catalytic residue",
    },
    THR: { one: "T", name: "Threonine", role: "polar hydroxyl" },
    TRP: { one: "W", name: "Tryptophan", role: "large aromatic, hydrophobic" },
    TYR: { one: "Y", name: "Tyrosine", role: "aromatic with polar hydroxyl" },
    VAL: { one: "V", name: "Valine", role: "branched, hydrophobic" },
  };

function plddtBand(b: number): { label: string; color: string } {
  if (b >= 90) return { label: "Very high (90–100)", color: "#5b8bf5" };
  if (b >= 70) return { label: "Confident (70–90)", color: "#65cbf3" };
  if (b >= 50) return { label: "Low (50–70)", color: "#ffdb13" };
  return { label: "Very low (<50)", color: "#ff7d45" };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

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
    let tooltipEl: HTMLDivElement | null = null;
    let moveCleanup: (() => void) | null = null;

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
          tooltip: false, // we render our own richer tooltip below
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

        // --- Hover tooltip: describe the residue under the cursor ----------
        const highlightSet = new Set(highlight);
        const tooltip = document.createElement("div");
        Object.assign(tooltip.style, {
          position: "absolute",
          zIndex: "10",
          pointerEvents: "none",
          display: "none",
          maxWidth: "17rem",
          padding: "8px 10px",
          borderRadius: "8px",
          background: "rgba(15,23,42,0.95)",
          color: "#e2e8f0",
          font: "12px/1.45 ui-sans-serif, system-ui, sans-serif",
          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        } as CSSStyleDeclaration);
        const host = hostRef.current;
        host.appendChild(tooltip);
        tooltipEl = tooltip;

        // Track the cursor in CSS pixels relative to the host. NGL's own
        // canvasPosition is in device pixels (wrong at devicePixelRatio > 1),
        // so we position from the real mouse instead.
        let mx = 0;
        let my = 0;
        const onMove = (e: MouseEvent) => {
          const r = host.getBoundingClientRect();
          mx = e.clientX - r.left;
          my = e.clientY - r.top;
        };
        host.addEventListener("mousemove", onMove);
        moveCleanup = () => host.removeEventListener("mousemove", onMove);

        stage.signals.hovered.add((pickingProxy: any) => {
          if (pickingProxy && (pickingProxy.atom || pickingProxy.bond)) {
            const atom = pickingProxy.atom || pickingProxy.closestBondAtom;
            const resname = String(atom.resname || "").toUpperCase();
            const aa = AMINO_ACIDS[resname];
            const resLabel = aa
              ? `${aa.name} (${aa.one})`
              : resname || "residue";
            const chain = atom.chainname ? ` · chain ${atom.chainname}` : "";
            const b = typeof atom.bfactor === "number" ? atom.bfactor : null;
            const band = b !== null ? plddtBand(b) : null;
            const isMut = highlightSet.has(atom.resno);

            tooltip.innerHTML = [
              `<div style="font-weight:600;color:#fff">${escapeHtml(
                resname,
              )} ${atom.resno}${escapeHtml(chain)}</div>`,
              `<div style="margin-top:2px">${escapeHtml(resLabel)}${
                aa ? ` — ${escapeHtml(aa.role)}` : ""
              }</div>`,
              band !== null && b !== null
                ? `<div style="margin-top:4px;color:#94a3b8">pLDDT ${b.toFixed(
                    1,
                  )} · <span style="color:${band.color}">${escapeHtml(
                    band.label,
                  )}</span></div>`
                : "",
              isMut
                ? `<div style="margin-top:4px;color:#f472b6;font-weight:600">● Mutation site</div>`
                : "",
            ].join("");

            // Show first so we can measure, then clamp within the host.
            tooltip.style.display = "block";
            tooltip.style.bottom = "auto";
            const r = host.getBoundingClientRect();
            const pad = 12;
            const left = Math.min(mx + pad, r.width - tooltip.offsetWidth - 8);
            const top = Math.min(my + pad, r.height - tooltip.offsetHeight - 8);
            tooltip.style.left = `${Math.max(4, left)}px`;
            tooltip.style.top = `${Math.max(4, top)}px`;
          } else {
            tooltip.style.display = "none";
          }
        });

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
      moveCleanup?.();
      tooltipEl?.remove();
      stage?.dispose?.();
    };
  }, [pdb, highlight]);

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="h-full w-full" />
      {status === "ready" && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-slate-200">
          Hover residues for details
        </div>
      )}
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
