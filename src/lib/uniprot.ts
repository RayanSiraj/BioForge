// Real enzyme-candidate lookup against UniProtKB. Nothing here is invented: the
// candidate list comes straight from UniProt's search API, and the canonical
// sequence used to seed variants is fetched by accession server-side
// (fetchEnzyme) rather than trusted from the client. This keeps the "any
// plastic" flow honest — real sequences, real accessions, real citations.

const BASE = "https://rest.uniprot.org/uniprotkb";
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "BioForge/1.0 (research prototype)",
};

export interface UniprotCandidate {
  accession: string;
  name: string;
  organism: string | null;
  length: number | null;
  reviewed: boolean;
}

export interface UniprotEnzyme {
  accession: string;
  name: string;
  organism: string | null;
  sequence: string;
}

// UniProt entries carry names in a few shapes depending on how they were
// annotated; fall back through them to a stable label.
function proteinName(r: any): string {
  const pd = r?.proteinDescription;
  return (
    pd?.recommendedName?.fullName?.value ??
    pd?.submissionNames?.[0]?.fullName?.value ??
    pd?.alternativeNames?.[0]?.fullName?.value ??
    r?.uniProtkbId ??
    r?.primaryAccession ??
    "Unnamed protein"
  );
}

// Search UniProtKB for enzymes plausibly associated with a plastic. The query
// pairs the free-text plastic name with degradation-related terms so arbitrary
// inputs (polystyrene, nylon-6, PLA…) still surface real hydrolases/oxidases.
export async function searchDegradingEnzymes(
  plastic: string,
  limit = 24,
): Promise<UniprotCandidate[]> {
  const term = plastic.trim();
  if (!term) return [];

  const query =
    `(${term}) AND ` +
    `(degrad* OR depolymerase OR depolymerizing OR hydrolase OR esterase OR cutinase OR oxidase)`;
  const url =
    `${BASE}/search?query=${encodeURIComponent(query)}` +
    `&fields=accession,protein_name,organism_name,length,reviewed` +
    `&format=json&size=${limit}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`UniProt search failed (${res.status})`);
  }

  const json = await res.json();
  const results: any[] = json?.results ?? [];
  const seen = new Set<string>();
  const out: UniprotCandidate[] = [];

  for (const r of results) {
    const accession = r?.primaryAccession;
    if (!accession || seen.has(accession)) continue;
    seen.add(accession);
    out.push({
      accession,
      name: proteinName(r),
      organism: r?.organism?.scientificName ?? null,
      length: r?.sequence?.length ?? null,
      reviewed: /reviewed/i.test(r?.entryType ?? ""),
    });
  }

  // Reviewed (Swiss-Prot) entries first — better-curated annotation.
  out.sort((a, b) => Number(b.reviewed) - Number(a.reviewed));
  return out;
}

// Fetch a single entry's canonical sequence by accession. Used when a user
// adopts a candidate, so the sequence we store is authoritative.
export async function fetchEnzyme(accession: string): Promise<UniprotEnzyme> {
  const clean = accession.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(clean)) {
    throw new Error(`Invalid UniProt accession "${accession}"`);
  }

  const res = await fetch(`${BASE}/${clean}.json`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`UniProt entry ${clean} not found (${res.status})`);
  }

  const r = await res.json();
  const sequence = r?.sequence?.value;
  if (!sequence || typeof sequence !== "string") {
    throw new Error(`No sequence available for ${clean}`);
  }

  return {
    accession: r?.primaryAccession ?? clean,
    name: proteinName(r),
    organism: r?.organism?.scientificName ?? null,
    sequence: sequence.replace(/\s+/g, "").toUpperCase(),
  };
}
