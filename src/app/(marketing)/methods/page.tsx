import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "../_components/Reveal";

export const metadata: Metadata = {
  title: "How BioForge works — Method",
  description:
    "The models and reasoning behind BioForge: ESM-2 masked-marginal scoring, AlphaFold + ESMFold structure prediction with pLDDT, active-site awareness, and the three-tier validation framework.",
};

const REFS = [
  {
    id: "yoshida2016",
    text: "Yoshida et al. (2016). A bacterium that degrades and assimilates poly(ethylene terephthalate). Science.",
    doi: "10.1126/science.aad6359",
  },
  {
    id: "tournier2020",
    text: "Tournier et al. (2020). An engineered PET depolymerase to break down and recycle plastic bottles. Nature.",
    doi: "10.1038/s41586-020-2149-4",
  },
  {
    id: "lu2022",
    text: "Lu et al. (2022). Machine learning-aided engineering of hydrolases for PET depolymerization (FAST-PETase). Nature.",
    doi: "10.1038/s41586-022-04599-z",
  },
  {
    id: "jumper2021",
    text: "Jumper et al. (2021). Highly accurate protein structure prediction with AlphaFold. Nature.",
    doi: "10.1038/s41586-021-03819-2",
  },
  {
    id: "lin2023",
    text: "Lin et al. (2023). Evolutionary-scale prediction of atomic-level protein structure with a language model (ESM-2 / ESMFold). Science.",
    doi: "10.1126/science.ade2574",
  },
  {
    id: "meier2021",
    text: "Meier et al. (2021). Language models enable zero-shot prediction of the effects of mutations on protein function. NeurIPS / bioRxiv.",
    doi: "10.1101/2021.07.09.450648",
  },
];

function Cite({ id }: { id: string }) {
  const i = REFS.findIndex((r) => r.id === id);
  return (
    <a href={`#ref-${id}`} className="text-signal-400 hover:underline">
      [{i + 1}]
    </a>
  );
}

export default function MethodsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <Reveal>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal-400">
          Method
        </span>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          How BioForge works
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-400">
          BioForge is a <strong className="text-slate-200">triage tool</strong>.
          It uses published models to rank enzyme variants by computational
          plausibility — to decide what is worth testing in a lab. It does not,
          and cannot, prove that an enzyme works or is safe. Here is exactly what
          each number means.
        </p>
      </Reveal>

      <div className="mt-14 space-y-14">
        <Section n="01" title="Match — real enzymes, cited">
          <p>
            You start from a plastic. BioForge surfaces candidate degrading
            enzymes from a curated reference set and from a live UniProtKB
            search, each carrying its real accession and source. Nothing is
            invented — the canonical sequence used to seed variants is fetched by
            accession, not trusted from the client. PET is the most tractable
            target; its ester backbone is cleaved by well-characterised hydrolases
            such as IsPETase <Cite id="yoshida2016" /> and engineered cutinases{" "}
            <Cite id="tournier2020" />.
          </p>
        </Section>

        <Section n="02" title="Score — ESM-2 masked-marginal likelihood">
          <p>
            Each mutation is scored with{" "}
            <strong className="text-slate-200">ESM-2</strong>, a protein language
            model trained on evolutionary sequence data <Cite id="lin2023" />. For
            every mutated position we mask that residue and read off the model&apos;s
            probability for the wild-type vs. the mutant amino acid; the per-mutation
            score is the log-likelihood ratio{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-signal-400">
              ln P(mut) − ln P(wt)
            </code>
            , summed across mutations <Cite id="meier2021" />.
          </p>
          <Callout>
            A positive score means the substitution is{" "}
            <em>evolutionarily plausible</em> — the model expects to see it, which
            correlates weakly with keeping the fold. It says{" "}
            <strong className="text-slate-200">nothing</strong> about catalytic
            rate, whether the enzyme actually cleaves the plastic, or expression.
          </Callout>
        </Section>

        <Section n="03" title="Fold — AlphaFold parent, ESMFold variant">
          <p>
            The parent enzyme&apos;s structure comes from{" "}
            <strong className="text-slate-200">AlphaFold DB</strong> (precomputed
            by UniProt ID) <Cite id="jumper2021" />. Your novel variant has no
            precomputed structure, so it&apos;s folded on demand with{" "}
            <strong className="text-slate-200">ESMFold</strong> — a single-sequence
            predictor that needs no multiple-sequence alignment <Cite id="lin2023" />.
            Both are coloured by{" "}
            <strong className="text-slate-200">pLDDT</strong>, a per-residue
            confidence score from 0–100.
          </p>
          <Callout>
            pLDDT is the model&apos;s confidence in its own predicted{" "}
            <em>shape</em> — not whether the enzyme is active. A mutation can keep
            pLDDT high and still abolish catalysis.
          </Callout>
        </Section>

        <Section n="04" title="Active-site awareness">
          <p>
            Catalysis runs through a small set of residues — for the
            cutinase/PETase family, a Ser–Asp–His triad whose nucleophilic serine
            sits in a conserved G-x-S-x-G elbow. BioForge locates these from the
            sequence and flags any mutation that lands on them:{" "}
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-sm font-medium text-red-300">
              catalytic
            </span>{" "}
            mutations are expected to kill activity regardless of how confident the
            fold looks.
          </p>
        </Section>

        <Section n="05" title="Verdict — and the three-tier framework">
          <p>
            The verdict combines the ESM-2 likelihood and the fold confidence into
            one plain-language read, framed as a prediction. It maps onto a
            three-tier validation ladder:
          </p>
          <ol className="mt-4 space-y-2">
            <Tier n={1} name="Computational" active>
              sequence + structure models — everything BioForge does
            </Tier>
            <Tier n={2} name="Colorimetric">
              Impranil DLN turbidity assay — a first wet signal of degradation
            </Tier>
            <Tier n={3} name="Wet-lab">
              benchtop confirmation on the real polymer, with byproduct analysis
            </Tier>
          </ol>
          <p className="mt-4">
            BioForge is <strong className="text-slate-200">Tier 1 only</strong>. A
            promising computational verdict is a reason to run Tier 2 — not
            evidence of success.
          </p>
        </Section>

        <Section n="06" title="What this does not tell you">
          <p>
            Honesty is the point. BioForge&apos;s numbers say nothing about
            catalytic activity, degradation rate, expression, solubility,
            byproducts (terephthalic acid, ethylene glycol, MHET), off-target
            activity, or safety and environmental release. Those are empirical
            questions answered at the bench, not by a sequence or structure model.
            Engineered designs like FAST-PETase <Cite id="lu2022" /> reached the
            lab through exactly that escalation.
          </p>
        </Section>
      </div>

      {/* References */}
      <Reveal className="mt-16 border-t border-white/5 pt-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
          References
        </h2>
        <ol className="mt-4 space-y-2 text-sm text-slate-400">
          {REFS.map((r, i) => (
            <li key={r.id} id={`ref-${r.id}`} className="flex gap-2">
              <span className="text-slate-600">[{i + 1}]</span>
              <span>
                {r.text}{" "}
                <a
                  href={`https://doi.org/${r.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal-400 hover:underline"
                >
                  doi:{r.doi}
                </a>
              </span>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal className="mt-14 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="rounded-xl bg-signal-500 px-5 py-3 font-medium text-ink-950 shadow-glow transition-transform hover:-translate-y-0.5"
        >
          Open the console
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-white/12 px-5 py-3 font-medium text-slate-200 hover:border-white/30 hover:bg-white/5"
        >
          ← Back to overview
        </Link>
      </Reveal>
    </main>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal as="section">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-signal-400">{n}</span>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 leading-relaxed text-slate-300 [&_p]:text-[15px]">
        {children}
      </div>
    </Reveal>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-signal-400/20 bg-signal-400/[0.06] px-4 py-3 text-[15px] text-slate-300">
      {children}
    </p>
  );
}

function Tier({
  n,
  name,
  active,
  children,
}: {
  n: number;
  name: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/8 bg-ink-900 px-4 py-3">
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-xs font-semibold ring-1 ${
          active
            ? "bg-signal-400/15 text-signal-400 ring-signal-400/30"
            : "bg-white/[0.04] text-slate-400 ring-white/8"
        }`}
      >
        T{n}
      </span>
      <p className="text-[15px] text-slate-300">
        <strong className="text-white">{name}</strong> — {children}
      </p>
    </li>
  );
}
