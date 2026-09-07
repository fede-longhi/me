/** Minimal binary STL writer (Z-up, print orientation). */

function cross(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export class StlWriter {
  private readonly view: DataView;
  private readonly buf: ArrayBuffer;
  private count = 0;
  private offset = 84;
  private readonly maxTris: number;

  constructor(maxTris: number) {
    this.maxTris = maxTris;
    this.buf = new ArrayBuffer(84 + maxTris * 50);
    this.view = new DataView(this.buf);
  }

  pushTri(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ) {
    if (this.count >= this.maxTris) return;
    const [nx, ny, nz] = normalize(
      ...cross(bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az),
    );
    this.view.setFloat32(this.offset, nx, true);
    this.view.setFloat32(this.offset + 4, ny, true);
    this.view.setFloat32(this.offset + 8, nz, true);
    this.offset += 12;
    for (const p of [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ] as const) {
      this.view.setFloat32(this.offset, p[0], true);
      this.view.setFloat32(this.offset + 4, p[1], true);
      this.view.setFloat32(this.offset + 8, p[2], true);
      this.offset += 12;
    }
    this.view.setUint16(this.offset, 0, true);
    this.offset += 2;
    this.count += 1;
  }

  finish(): ArrayBuffer {
    this.view.setUint32(80, this.count, true);
    return this.buf.slice(0, 84 + this.count * 50);
  }

  get triangleCount() {
    return this.count;
  }
}

export function pushQuad(
  writer: StlWriter,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
) {
  writer.pushTri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  writer.pushTri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
}

export function stlTriangleCount(buffer: ArrayBuffer): number {
  if (buffer.byteLength < 84) return 0;
  return new DataView(buffer).getUint32(80, true);
}
