import type { LucideProps } from "lucide-react";
import {
  Box,
  Brush,
  Circle,
  Download,
  Earth,
  Ellipse,
  Eraser,
  Focus,
  LineSquiggle,
  Move,
  PlusCircle,
  Redo2,
  RefreshCw,
  Square,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";

type IconProps = { className?: string };

function withDefaults(props: IconProps): LucideProps {
  return {
    size: 16,
    strokeWidth: 2,
    "aria-hidden": true,
    className: props.className ?? "h-4 w-4 shrink-0",
  };
}

export function IconPan(props: IconProps) {
  return <Move {...withDefaults(props)} />;
}

export function IconRect(props: IconProps) {
  return <Square {...withDefaults(props)} />;
}

export function IconCircle(props: IconProps) {
  return <Circle {...withDefaults(props)} />;
}

export function IconEllipse(props: IconProps) {
  return <Ellipse {...withDefaults(props)} />;
}

export function IconBrush(props: IconProps) {
  return <Brush {...withDefaults(props)} />;
}

export function IconFreehand(props: IconProps) {
  return <LineSquiggle {...withDefaults(props)} />;
}

export function IconBoundary(props: IconProps) {
  return <Earth {...withDefaults(props)} />;
}

export function IconEraser(props: IconProps) {
  return <Eraser {...withDefaults(props)} />;
}

export function IconAdd(props: IconProps) {
  return <PlusCircle {...withDefaults(props)} />;
}

export function IconReplace(props: IconProps) {
  return <RefreshCw {...withDefaults(props)} />;
}

export function IconUndo(props: IconProps) {
  return <Undo2 {...withDefaults(props)} />;
}

export function IconRedo(props: IconProps) {
  return <Redo2 {...withDefaults(props)} />;
}

export function IconClear(props: IconProps) {
  return <Trash2 {...withDefaults(props)} />;
}

export function IconFit(props: IconProps) {
  return <Focus {...withDefaults(props)} />;
}

export function IconCancel(props: IconProps) {
  return <XCircle {...withDefaults(props)} />;
}

export function IconGenerate(props: IconProps) {
  return <Box {...withDefaults(props)} />;
}

export function IconDownload(props: IconProps) {
  return <Download {...withDefaults(props)} />;
}
