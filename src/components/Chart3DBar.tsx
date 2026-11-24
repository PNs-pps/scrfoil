import React from 'react';
import { normalizePattern, resolveStandardPattern } from '../utils/soFormatter';

export interface ChartBar3DPalette {
  /** Top 3D isometric face (brightest highlight) */
  top: string;
  /** Front face gradient top stop */
  frontTop: string;
  /** Front face gradient bottom stop */
  frontBottom: string;
  /** Right 3D shaded side gradient top */
  side: string;
  /** Right 3D shaded side gradient bottom (optional darker shade) */
  sideBottom?: string;
  /** Crisp border stroke around 3D faces */
  stroke: string;
  /** Subtle inner specular sheen along top-left rim */
  sheen?: string;
}

export const METRIC_3D_PALETTES = {
  emerald: {
    top: '#34d399',
    frontTop: '#10b981',
    frontBottom: '#047857',
    side: '#065f46',
    sideBottom: '#064e3b',
    stroke: '#064e3b',
    sheen: 'rgba(255,255,255,0.42)',
  },
  teal: {
    top: '#2dd4bf',
    frontTop: '#14b8a6',
    frontBottom: '#0f766e',
    side: '#115e59',
    sideBottom: '#134e4a',
    stroke: '#134e4a',
    sheen: 'rgba(255,255,255,0.42)',
  },
  sky: {
    top: '#38bdf8',
    frontTop: '#0ea5e9',
    frontBottom: '#0369a1',
    side: '#075985',
    sideBottom: '#0c4a6e',
    stroke: '#0c4a6e',
    sheen: 'rgba(255,255,255,0.42)',
  },
  slate: {
    top: '#94a3b8',
    frontTop: '#64748b',
    frontBottom: '#334155',
    side: '#1e293b',
    sideBottom: '#0f172a',
    stroke: '#1e293b',
    sheen: 'rgba(255,255,255,0.32)',
  },
  rose: {
    top: '#fb7185',
    frontTop: '#f43f5e',
    frontBottom: '#be123c',
    side: '#9f1239',
    sideBottom: '#881337',
    stroke: '#881337',
    sheen: 'rgba(255,255,255,0.38)',
  },
  indigo: {
    top: '#a5b4fc',
    frontTop: '#818cf8',
    frontBottom: '#4338ca',
    side: '#3730a3',
    sideBottom: '#312e81',
    stroke: '#312e81',
    sheen: 'rgba(255,255,255,0.40)',
  },
} satisfies Record<string, ChartBar3DPalette>;

export const FOIL_PATTERN_3D_PALETTES: Record<string, ChartBar3DPalette> = {
  'ขาว': {
    top: '#ffffff',
    frontTop: '#f8fafc',
    frontBottom: '#dbe2ea',
    side: '#cbd5e1',
    sideBottom: '#94a3b8',
    stroke: '#64748b',
    sheen: 'rgba(255,255,255,0.95)',
  },
  'ดำ': {
    top: '#475569',
    frontTop: '#334155',
    frontBottom: '#020617',
    side: '#0f172a',
    sideBottom: '#020617',
    stroke: '#020617',
    sheen: 'rgba(255,255,255,0.22)',
  },
  'ไม้อ่อน': {
    top: '#fde68a',
    frontTop: '#fbbf24',
    frontBottom: '#d97706',
    side: '#b45309',
    sideBottom: '#92400e',
    stroke: '#78350f',
    sheen: 'rgba(255,255,255,0.48)',
  },
  'ไม้เข้ม': {
    top: '#b45309',
    frontTop: '#92400e',
    frontBottom: '#451a03',
    side: '#451a03',
    sideBottom: '#290d04',
    stroke: '#451a03',
    sheen: 'rgba(255,255,255,0.28)',
  },
  'เทา': {
    top: '#94a3b8',
    frontTop: '#64748b',
    frontBottom: '#334155',
    side: '#334155',
    sideBottom: '#1e293b',
    stroke: '#1e293b',
    sheen: 'rgba(255,255,255,0.34)',
  },
  'กลีบบัว': {
    top: '#fda4af',
    frontTop: '#fb7185',
    frontBottom: '#e11d48',
    side: '#be123c',
    sideBottom: '#9f1239',
    stroke: '#9f1239',
    sheen: 'rgba(255,255,255,0.42)',
  },
};

export function getFoilPattern3DPalette(pattern: string): ChartBar3DPalette {
  const norm = resolveStandardPattern(pattern) ?? normalizePattern(pattern);
  return FOIL_PATTERN_3D_PALETTES[norm] || METRIC_3D_PALETTES.indigo;
}

export interface Bar3DShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  value?: number | [number, number];
  payload?: Record<string, unknown>;
  chartId: string;
  seriesKey: string;
  palette?: ChartBar3DPalette;
  getPalette?: (payload: Record<string, unknown> | undefined, index: number) => ChartBar3DPalette;
  /** Ordered bottom-to-top keys for stacked bar series */
  stackKeys?: string[];
}

function sanitizeIdPart(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const Bar3DShape: React.FC<Bar3DShapeProps> = ({
  x,
  y,
  width,
  height,
  index = 0,
  value,
  payload,
  chartId,
  seriesKey,
  palette,
  getPalette,
  stackKeys,
}) => {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const numericVal = Array.isArray(value)
    ? Number(value[1]) - Number(value[0])
    : typeof value === 'number'
      ? value
      : Number(payload?.[seriesKey] ?? 0);

  if (!Number.isFinite(numericVal) || numericVal <= 0) {
    return null;
  }

  const resolvedPalette =
    (getPalette ? getPalette(payload, index) : palette) || METRIC_3D_PALETTES.emerald;

  // Determine stacked cap visibility so lower stacked segments don't poke through short upper bars
  let isTopSegment = true;
  if (stackKeys && stackKeys.length > 0 && payload) {
    const activeKeys = stackKeys.filter((k) => Number(payload[k]) > 0);
    if (activeKeys.length > 0) {
      isTopSegment = activeKeys[activeKeys.length - 1] === seriesKey;
    }
  }

  // Proportional isometric 3D offset (scales smoothly for grouped narrow bars vs wide single bars)
  const dx = Math.max(2.5, Math.min(8.5, Number((width * 0.24).toFixed(2))));
  const dy = Math.max(2, Math.min(6, Number((dx * 0.62).toFixed(2))));

  const uid = `${sanitizeIdPart(chartId)}-${sanitizeIdPart(seriesKey)}-${index}`;
  const frontGradId = `bar3d-front-${uid}`;
  const sideGradId = `bar3d-side-${uid}`;

  const rightEdge = x + width;
  const bottomEdge = y + height;

  const sidePoints = [
    `${rightEdge},${y}`,
    `${rightEdge + dx},${y - dy}`,
    `${rightEdge + dx},${bottomEdge - dy}`,
    `${rightEdge},${bottomEdge}`,
  ].join(' ');

  const topPoints = [
    `${x},${y}`,
    `${x + dx},${y - dy}`,
    `${rightEdge + dx},${y - dy}`,
    `${rightEdge},${y}`,
  ].join(' ');

  return (
    <g className="transition-opacity duration-150">
      <defs>
        <linearGradient id={frontGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={resolvedPalette.frontTop} />
          <stop offset="100%" stopColor={resolvedPalette.frontBottom} />
        </linearGradient>
        <linearGradient id={sideGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={resolvedPalette.side} />
          <stop
            offset="100%"
            stopColor={resolvedPalette.sideBottom || resolvedPalette.side}
          />
        </linearGradient>
      </defs>

      {/* Right 3D extruded face */}
      <polygon
        points={sidePoints}
        fill={`url(#${sideGradId})`}
        stroke={resolvedPalette.stroke}
        strokeWidth={0.7}
        strokeLinejoin="round"
      />

      {/* Front gradient face */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`url(#${frontGradId})`}
        stroke={resolvedPalette.stroke}
        strokeWidth={0.8}
      />

      {/* Subtle studio specular highlight on front edges */}
      {width >= 7 && height >= 4 && (
        <line
          x1={x + 1}
          y1={y + 1}
          x2={x + 1}
          y2={bottomEdge - 1}
          stroke={resolvedPalette.sheen || 'rgba(255,255,255,0.35)'}
          strokeWidth={1.1}
        />
      )}
      {isTopSegment && width >= 7 && height >= 2 && (
        <line
          x1={x + 1}
          y1={y + 1}
          x2={rightEdge - 1}
          y2={y + 1}
          stroke={resolvedPalette.sheen || 'rgba(255,255,255,0.45)'}
          strokeWidth={1.1}
        />
      )}

      {/* Top 3D diamond cap — only rendered on the topmost visible bar/segment */}
      {isTopSegment && (
        <polygon
          points={topPoints}
          fill={resolvedPalette.top}
          stroke={resolvedPalette.stroke}
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
};
