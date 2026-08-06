export type GridRenderOptions = {
  rows: number;
  cols: number;
  lineWidth: number;
  strokeStyle: string;
};

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  return { canvas, ctx };
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { rows, cols, lineWidth, strokeStyle }: GridRenderOptions,
) {
  const cellW = width / cols;
  const cellH = height / rows;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  // Offset by half a pixel for crisp 1px strokes on integer coords
  const offset = lineWidth % 2 === 1 ? 0.5 : 0;

  for (let i = 0; i <= cols; i += 1) {
    const x = Math.min(width, i * cellW) + (i === cols ? -offset : offset);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let j = 0; j <= rows; j += 1) {
    const y = Math.min(height, j * cellH) + (j === rows ? -offset : offset);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

export function renderOverlayGrid(
  image: HTMLImageElement | ImageBitmap,
  rows: number,
  cols: number,
  fineLineWidth = 1,
  strokeStyle = "#000000",
) {
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const { canvas, ctx } = createCanvas(width, height);

  ctx.drawImage(image, 0, 0, width, height);
  drawGrid(ctx, width, height, {
    rows,
    cols,
    lineWidth: fineLineWidth,
    strokeStyle,
  });

  return canvas;
}

export function renderBlankGrid(
  width: number,
  height: number,
  rows: number,
  cols: number,
  thickLineWidth = 4,
  strokeStyle = "#111111",
) {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, {
    rows,
    cols,
    lineWidth: thickLineWidth,
    strokeStyle,
  });
  return canvas;
}

export function renderCombined(
  overlay: HTMLCanvasElement,
  blank: HTMLCanvasElement,
  gap = 0,
) {
  const width = overlay.width * 2 + gap;
  const height = Math.max(overlay.height, blank.height);
  const { canvas, ctx } = createCanvas(width, height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(overlay, 0, 0);
  ctx.drawImage(blank, overlay.width + gap, 0);

  return canvas;
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

export function createIdentityOrder(rows: number, cols: number) {
  return Array.from({ length: rows * cols }, (_, index) => index);
}

export function shuffleOrder(order: readonly number[]) {
  return shuffleInPlace([...order]);
}

export function swapOrderIndices(
  order: readonly number[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return [...order];
  }
  const next = [...order];
  const tmp = next[fromIndex];
  next[fromIndex] = next[toIndex];
  next[toIndex] = tmp;
  return next;
}

export function renderTiledImage(
  image: HTMLImageElement | ImageBitmap,
  rows: number,
  cols: number,
  order: readonly number[],
  options?: {
    withFineGrid?: boolean;
    fineLineWidth?: number;
    strokeStyle?: string;
  },
) {
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const { canvas, ctx } = createCanvas(width, height);

  const cellW = width / cols;
  const cellH = height / rows;
  const expected = rows * cols;
  if (order.length !== expected) {
    throw new Error(
      `Tile order length ${order.length} does not match grid size ${expected}`,
    );
  }

  for (let dest = 0; dest < order.length; dest += 1) {
    const src = order[dest];
    const srcCol = src % cols;
    const srcRow = Math.floor(src / cols);
    const destCol = dest % cols;
    const destRow = Math.floor(dest / cols);

    const sx = srcCol * cellW;
    const sy = srcRow * cellH;
    const dx = destCol * cellW;
    const dy = destRow * cellH;

    const sw = srcCol === cols - 1 ? width - sx : cellW;
    const sh = srcRow === rows - 1 ? height - sy : cellH;
    const dw = destCol === cols - 1 ? width - dx : cellW;
    const dh = destRow === rows - 1 ? height - dy : cellH;

    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  if (options?.withFineGrid !== false) {
    drawGrid(ctx, width, height, {
      rows,
      cols,
      lineWidth: options?.fineLineWidth ?? 1,
      strokeStyle: options?.strokeStyle ?? "#000000",
    });
  }

  return canvas;
}

export function renderScrambledImage(
  image: HTMLImageElement | ImageBitmap,
  rows: number,
  cols: number,
  options?: {
    withFineGrid?: boolean;
    fineLineWidth?: number;
    strokeStyle?: string;
  },
) {
  return renderTiledImage(
    image,
    rows,
    cols,
    shuffleOrder(createIdentityOrder(rows, cols)),
    options,
  );
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  type: "image/png" | "image/jpeg" = "image/png",
) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL(type);
  link.click();
}
