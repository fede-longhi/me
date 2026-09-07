declare module "d3-delaunay" {
  export class Delaunay {
    static from(
      points: ArrayLike<number> | Iterable<[number, number]>,
    ): Delaunay;
    voronoi(bounds?: [number, number, number, number]): Voronoi;
  }

  export interface Voronoi {
    cellPolygon(i: number): [number, number][] | null;
  }
}
