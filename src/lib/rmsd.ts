// ---------------------------------------------------------------------------
// Lightweight structural comparison — pure TypeScript, NO external dependency.
//
// Extract Cα coordinates from PDB text and compute the minimal-RMSD
// superposition over a set of matched residues using the quaternion method
// (Coutsias/Theobald "qcprot"): the optimal-rotation RMSD is obtained from the
// largest eigenvalue of a symmetric 4×4 key matrix built from the correlation
// matrix, without ever forming the rotation itself. The eigenvalue is found by
// cyclic Jacobi rotations. This avoids pulling in BioPython / a JS structure
// library for a single well-known calculation.
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

/** Map of 1-indexed residue number -> Cα coordinate, parsed from PDB ATOM records. */
export function caCoordsByResidue(pdb: string): Map<number, Vec3> {
  const map = new Map<number, Vec3>();
  for (const line of pdb.split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    if (line.slice(12, 16).trim() !== "CA") continue;
    const resSeq = parseInt(line.slice(22, 26).trim(), 10);
    const x = parseFloat(line.slice(30, 38));
    const y = parseFloat(line.slice(38, 46));
    const z = parseFloat(line.slice(46, 54));
    if (![resSeq, x, y, z].some(Number.isNaN)) map.set(resSeq, [x, y, z]);
  }
  return map;
}

/**
 * RMSD (Å) between two equal-length ordered Cα sets after optimal rigid-body
 * superposition. Returns null if fewer than 3 pairs are supplied (a plane is
 * the minimum needed for a meaningful 3-D fit).
 */
export function superposeRmsd(a: Vec3[], b: Vec3[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;

  const cA = centroid(a, n);
  const cB = centroid(b, n);

  // Inner products + correlation matrix R over centered coordinates.
  let gA = 0;
  let gB = 0;
  const R = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let k = 0; k < n; k++) {
    const ax = a[k][0] - cA[0];
    const ay = a[k][1] - cA[1];
    const az = a[k][2] - cA[2];
    const bx = b[k][0] - cB[0];
    const by = b[k][1] - cB[1];
    const bz = b[k][2] - cB[2];
    gA += ax * ax + ay * ay + az * az;
    gB += bx * bx + by * by + bz * bz;
    R[0][0] += ax * bx; R[0][1] += ax * by; R[0][2] += ax * bz;
    R[1][0] += ay * bx; R[1][1] += ay * by; R[1][2] += ay * bz;
    R[2][0] += az * bx; R[2][1] += az * by; R[2][2] += az * bz;
  }

  const lambdaMax = largestEigenvalueSym4(keyMatrix(R));
  const msd = Math.max(0, (gA + gB - 2 * lambdaMax) / n);
  return Math.sqrt(msd);
}

function centroid(pts: Vec3[], n: number): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let k = 0; k < n; k++) {
    x += pts[k][0];
    y += pts[k][1];
    z += pts[k][2];
  }
  return [x / n, y / n, z / n];
}

// Symmetric 4×4 key matrix F from the 3×3 correlation matrix R. Its largest
// eigenvalue equals the maximal sum of aligned inner products.
function keyMatrix(R: number[][]): number[][] {
  const [Rxx, Rxy, Rxz] = R[0];
  const [Ryx, Ryy, Ryz] = R[1];
  const [Rzx, Rzy, Rzz] = R[2];
  return [
    [Rxx + Ryy + Rzz, Ryz - Rzy, Rzx - Rxz, Rxy - Ryx],
    [Ryz - Rzy, Rxx - Ryy - Rzz, Rxy + Ryx, Rzx + Rxz],
    [Rzx - Rxz, Rxy + Ryx, -Rxx + Ryy - Rzz, Ryz + Rzy],
    [Rxy - Ryx, Rzx + Rxz, Ryz + Rzy, -Rxx - Ryy + Rzz],
  ];
}

// Largest eigenvalue of a symmetric 4×4 matrix via cyclic Jacobi rotations.
function largestEigenvalueSym4(input: number[][]): number {
  const n = 4;
  const A = input.map((row) => row.slice());

  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-14) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        // Rotation angle that zeroes A[p][q] (tan 2θ = 2·A_pq / (A_qq − A_pp)).
        const theta = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        // A <- Jᵀ A J  (rotate columns p,q then rows p,q).
        for (let i = 0; i < n; i++) {
          const aip = A[i][p];
          const aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < n; i++) {
          const api = A[p][i];
          const aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[q][i] = s * api + c * aqi;
        }
      }
    }
  }
  return Math.max(A[0][0], A[1][1], A[2][2], A[3][3]);
}
