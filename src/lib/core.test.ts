import { describe, it, expect } from "vitest";
import { diffMutations } from "@/lib/structures";
import {
  classifyResidue,
  catalyticSiteFor,
  petaseActiveSiteResidues,
  PETASE_UNIPROT,
} from "@/lib/activeSite";
import { perResiduePlddt } from "@/lib/pdb";
import { superposeRmsd, caCoordsByResidue, type Vec3 } from "@/lib/rmsd";
import { buildVerdict } from "@/lib/verdict";
import type { MutationScore } from "@/lib/esm2";
import { generateVariants } from "@/lib/variants";

// Build a column-correct PDB CA ATOM line (pLDDT in the B-factor column).
function caLine(resSeq: number, x: number, y: number, z: number, b: number) {
  return (
    "ATOM".padEnd(6) +
    "    1" + // serial
    " " +
    " CA " + // atom name (cols 13-16)
    " " + // altLoc
    "ALA" + // resName
    " " +
    "A" + // chain
    String(resSeq).padStart(4) + // resSeq (cols 23-26)
    "    " + // iCode + pad (cols 27-30)
    x.toFixed(3).padStart(8) +
    y.toFixed(3).padStart(8) +
    z.toFixed(3).padStart(8) +
    "  1.00" + // occupancy
    b.toFixed(2).padStart(6) // tempFactor / pLDDT (cols 61-66)
  );
}

describe("diffMutations", () => {
  it("finds point substitutions, 1-indexed", () => {
    expect(diffMutations("ABCDE", "ABXDE")).toEqual([
      { position: 3, from: "C", to: "X" },
    ]);
  });
  it("returns none for identical sequences", () => {
    expect(diffMutations("MKTAY", "MKTAY")).toEqual([]);
  });
  it("normalises case and strips non-letters", () => {
    expect(diffMutations("mk tay", "MKTAG")).toEqual([
      { position: 5, from: "Y", to: "G" },
    ]);
  });
});

describe("classifyResidue (active-site)", () => {
  it("flags the PETase catalytic triad", () => {
    expect(classifyResidue(PETASE_UNIPROT, 134)).toBe("catalytic");
    expect(classifyResidue(PETASE_UNIPROT, 180)).toBe("catalytic");
    expect(classifyResidue(PETASE_UNIPROT, 211)).toBe("catalytic");
  });
  it("flags the ±2 pocket as active-site, elsewhere as other", () => {
    expect(classifyResidue(PETASE_UNIPROT, 136)).toBe("active-site");
    expect(classifyResidue(PETASE_UNIPROT, 50)).toBe("other");
  });
  it("flags the LCC cutinase nucleophile Ser165", () => {
    expect(classifyResidue("G9BY57", 165)).toBe("catalytic");
    expect(classifyResidue("G9BY57", 166)).toBe("active-site");
  });
  it("returns 'other' for unmapped / null families", () => {
    expect(classifyResidue("NOPE", 100)).toBe("other");
    expect(classifyResidue(null, 100)).toBe("other");
    expect(catalyticSiteFor("NOPE")).toBeNull();
  });
  it("PETase active-site set is the triad ±2 (15 residues)", () => {
    expect(petaseActiveSiteResidues()).toHaveLength(15);
  });
});

describe("perResiduePlddt", () => {
  it("maps residue number -> CA B-factor", () => {
    const pdb = [caLine(1, 0, 0, 0, 91.5), caLine(2, 1, 0, 0, 42)].join("\n");
    const m = perResiduePlddt(pdb);
    expect(m.get(1)).toBeCloseTo(91.5, 2);
    expect(m.get(2)).toBeCloseTo(42, 2);
  });
});

describe("superposeRmsd", () => {
  const a: Vec3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  it("is ~0 for identical point sets", () => {
    expect(superposeRmsd(a, a)!).toBeCloseTo(0, 6);
  });
  it("removes rigid translation (~0 after superposition)", () => {
    const shifted: Vec3[] = a.map(([x, y, z]) => [x + 10, y - 5, z + 3]);
    expect(superposeRmsd(a, shifted)!).toBeCloseTo(0, 6);
  });
  it("returns null for fewer than 3 pairs", () => {
    expect(superposeRmsd([[0, 0, 0]], [[0, 0, 0]])).toBeNull();
  });
  it("parses CA coordinates from PDB", () => {
    const pdb = [caLine(1, 1.5, 2.5, 3.5, 90)].join("\n");
    expect(caCoordsByResidue(pdb).get(1)).toEqual([1.5, 2.5, 3.5]);
  });
});

describe("buildVerdict", () => {
  const ms = (delta: number): MutationScore => ({
    position: 10,
    from: "A",
    to: "G",
    wtProb: 0.1,
    mutProb: 0.1 * Math.exp(delta),
    delta,
  });

  it("is inconclusive with no mutations", () => {
    const v = buildVerdict({
      esmScore: null,
      mutations: [],
      meanPlddt: null,
      mutatedResiduePlddt: [],
    });
    expect(v.tone).toBe("inconclusive");
    expect(v.caveats.length).toBeGreaterThanOrEqual(3);
  });
  it("is favorable when ESM favours the change and the fold is confident", () => {
    const v = buildVerdict({
      esmScore: 1.1,
      mutations: [ms(1.1)],
      meanPlddt: 95,
      mutatedResiduePlddt: [{ position: 10, plddt: 95 }],
    });
    expect(v.tone).toBe("favorable");
  });
  it("is risky when a mutation is strongly disfavoured", () => {
    const v = buildVerdict({
      esmScore: -5,
      mutations: [ms(-5)],
      meanPlddt: 95,
      mutatedResiduePlddt: [{ position: 10, plddt: 95 }],
    });
    expect(v.tone).toBe("risky");
  });
  it("always carries the non-negotiable caveats", () => {
    const v = buildVerdict({
      esmScore: 0.5,
      mutations: [ms(0.5)],
      meanPlddt: 90,
      mutatedResiduePlddt: [{ position: 10, plddt: 90 }],
    });
    expect(v.caveats.join(" ")).toMatch(/not a measurement|wet-lab|Tier/i);
  });
});

describe("generateVariants", () => {
  const ref = "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQGADLVYMLKTAYIAKQRQ";
  it("produces distinct point-mutants of the same length", () => {
    const vs = generateVariants(ref, { count: 5, mutationsPerVariant: 1 });
    expect(vs.length).toBeGreaterThan(0);
    expect(vs.length).toBeLessThanOrEqual(5);
    for (const v of vs) {
      expect(v).not.toBe(ref);
      expect(v.length).toBe(ref.length);
      expect(v).toMatch(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
      // exactly one substitution for mutationsPerVariant: 1
      expect(diffMutations(ref, v)).toHaveLength(1);
    }
    // uniqueness
    expect(new Set(vs).size).toBe(vs.length);
  });
});
