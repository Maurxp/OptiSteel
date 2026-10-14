import React, { useMemo } from 'react';
import type { CriticalPoint, Discontinuity, ValueExtremum } from '@optisteel/core';

interface DiagramChartProps {
  title: string;
  unit: string;
  length: number;
  evaluate: (x: number, side?: 'left' | 'right') => number;
  criticalPoints?: CriticalPoint[];
  discontinuities?: Discontinuity[];
  maxExtremum?: ValueExtremum;
  minExtremum?: ValueExtremum;
  invertYAxis?: boolean; // For deflection where y is downward positive
  colorTheme?: 'cyan' | 'purple' | 'emerald';
}

export const DiagramChart: React.FC<DiagramChartProps> = ({
  title,
  unit,
  length,
  evaluate,
  criticalPoints = [],
  discontinuities = [],
  maxExtremum,
  minExtremum,
  invertYAxis = false,
  colorTheme = 'cyan',
}) => {
  const L = Math.max(0.1, length);

  // SVG layout
  const width = 800;
  const height = 240;
  const padLeft = 70;
  const padRight = 50;
  const padTop = 32;
  const padBottom = 38;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  // Sample function across [0, L]
  const { points, zeroY, toSvgCoords } = useMemo(() => {
    const numSamples = 300;
    const pts: { x: number; y: number }[] = [];

    // Collect all critical x coordinates to ensure sharp jumps
    const specialX = new Set<number>([0, L]);
    criticalPoints.forEach((p) => {
      if (p.x >= 0 && p.x <= L) specialX.add(p.x);
    });
    discontinuities.forEach((d) => {
      if (d.x >= 0 && d.x <= L) specialX.add(d.x);
    });

    const discXSet = new Set<number>(discontinuities.map((d) => d.x));

    let minVal = 0;
    let maxVal = 0;

    for (let i = 0; i <= numSamples; i++) {
      const x = (i / numSamples) * L;
      const val = evaluate(x);
      if (Number.isFinite(val)) {
        minVal = Math.min(minVal, val);
        maxVal = Math.max(maxVal, val);
      }
    }

    // Add extra padding to y range
    const range = Math.max(1e-5, maxVal - minVal);
    const effMin = minVal - 0.15 * range;
    const effMax = maxVal + 0.15 * range;
    const totalRange = effMax - effMin;

    // Helper to map (xCoord, val) to SVG coords
    const toSvgCoords = (xCoord: number, val: number) => {
      const sx = padLeft + (xCoord / L) * plotWidth;
      let normY = (val - effMin) / totalRange;
      if (invertYAxis) {
        normY = 1 - normY;
      }
      const sy = padTop + (1 - normY) * plotHeight;
      return { x: sx, y: sy };
    };

    // Build dense points including left/right discontinuity limits
    const sortedX = Array.from(specialX).sort((a, b) => a - b);
    const allX: { x: number; side?: 'left' | 'right' }[] = [];

    let currX = 0;
    for (const sx of sortedX) {
      const steps = Math.max(2, Math.round(((sx - currX) / L) * numSamples));
      for (let s = 0; s < steps; s++) {
        const x = currX + (s / steps) * (sx - currX);
        allX.push({ x });
      }
      if (discXSet.has(sx)) {
        allX.push({ x: sx, side: 'left' });
        allX.push({ x: sx, side: 'right' });
      } else {
        allX.push({ x: sx });
      }
      currX = sx;
    }
    allX.push({ x: L });

    for (const item of allX) {
      const val = evaluate(item.x, item.side);
      if (Number.isFinite(val)) {
        pts.push(toSvgCoords(item.x, val));
      }
    }

    const zY = toSvgCoords(0, 0).y;

    return {
      points: pts,
      yMin: minVal,
      yMax: maxVal,
      zeroY: zY,
      toSvgCoords,
    };
  }, [L, evaluate, criticalPoints, discontinuities, invertYAxis, plotWidth, plotHeight, padLeft, padTop]);

  // Build SVG path
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  }, [points]);

  // Build filled polygon against zero line
  const fillD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return `${pathD} L ${last.x.toFixed(1)} ${zeroY.toFixed(1)} L ${first.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  }, [pathD, points, zeroY]);

  // Color mapping
  const strokeColor = colorTheme === 'emerald' ? '#10b981' : colorTheme === 'purple' ? '#a855f7' : '#38bdf8';
  const fillColor =
    colorTheme === 'emerald'
      ? 'rgba(16, 185, 129, 0.15)'
      : colorTheme === 'purple'
      ? 'rgba(168, 85, 247, 0.15)'
      : 'rgba(56, 189, 248, 0.15)';

  return (
    <div className="diagram-container">
      <div className="diagram-header">
        <div className="diagram-title">
          <span style={{ color: strokeColor }}>●</span>
          {title}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {maxExtremum && (
            <span className="diagram-badge" style={{ color: strokeColor }}>
              Máx: {maxExtremum.value.toFixed(3)} {unit} (x={maxExtremum.x.toFixed(2)}m)
            </span>
          )}
          {minExtremum && minExtremum.value !== maxExtremum?.value && (
            <span className="diagram-badge">
              Mín: {minExtremum.value.toFixed(3)} {unit} (x={minExtremum.x.toFixed(2)}m)
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="svg-responsive" aria-label={`Diagrama de ${title}`}>
        <defs>
          <linearGradient id={`grad-${colorTheme}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Outer boundary grid lines */}
        <line x1={padLeft} y1={padTop} x2={padLeft + plotWidth} y2={padTop} stroke="#1e293b" strokeDasharray="3 3" />
        <line
          x1={padLeft}
          y1={padTop + plotHeight / 2}
          x2={padLeft + plotWidth}
          y2={padTop + plotHeight / 2}
          stroke="#1e293b"
          strokeDasharray="3 3"
        />
        <line
          x1={padLeft}
          y1={padTop + plotHeight}
          x2={padLeft + plotWidth}
          y2={padTop + plotHeight}
          stroke="#1e293b"
          strokeDasharray="3 3"
        />

        {/* Zero baseline */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={padLeft + plotWidth}
          y2={zeroY}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <text
          x={padLeft - 10}
          y={zeroY + 3.5}
          fill="#94a3b8"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="end"
          fontWeight="600"
        >
          0.00
        </text>

        {/* Filled Area */}
        {fillD && <path d={fillD} fill={fillColor} />}

        {/* Function Curve */}
        {pathD && <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinejoin="round" />}

        {/* X Axis Line & Coordinates */}
        <line
          x1={padLeft}
          y1={height - padBottom + 12}
          x2={padLeft + plotWidth}
          y2={height - padBottom + 12}
          stroke="#334155"
        />
        <text
          x={padLeft}
          y={height - 8}
          fill="#94a3b8"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          0.0 m
        </text>
        <text
          x={padLeft + plotWidth / 4}
          y={height - 8}
          fill="#64748b"
          fontSize="9.5"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {(L * 0.25).toFixed(2)} m
        </text>
        <text
          x={padLeft + plotWidth / 2}
          y={height - 8}
          fill="#94a3b8"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {(L * 0.5).toFixed(2)} m
        </text>
        <text
          x={padLeft + (3 * plotWidth) / 4}
          y={height - 8}
          fill="#64748b"
          fontSize="9.5"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {(L * 0.75).toFixed(2)} m
        </text>
        <text
          x={padLeft + plotWidth}
          y={height - 8}
          fill="#94a3b8"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {L.toFixed(2)} m
        </text>

        {/* Highlight Peak Extrema Markers using exact toSvgCoords */}
        {criticalPoints
          .filter((p) => p.type === 'global_max' || p.type === 'global_min' || p.type === 'local_max')
          .slice(0, 4)
          .map((pt, idx) => {
            const { x: sx, y: sy } = toSvgCoords(pt.x, pt.value);
            const isNearTop = sy < padTop + 25;
            const badgeY = isNearTop ? sy + 10 : sy - 24;
            const textY = isNearTop ? sy + 21 : sy - 13;

            return (
              <g key={idx} className="extrema-marker">
                <circle cx={sx} cy={sy} r="4" fill={strokeColor} stroke="#0b101b" strokeWidth="2" />
                <rect
                  x={sx - 35}
                  y={badgeY}
                  width="70"
                  height="16"
                  rx="3"
                  fill="rgba(11, 16, 27, 0.9)"
                  stroke={strokeColor}
                  strokeWidth="0.8"
                />
                <text
                  x={sx}
                  y={textY}
                  fill="#ffffff"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {pt.value.toFixed(2)} {unit}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
};
