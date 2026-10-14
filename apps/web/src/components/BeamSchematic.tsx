import React from 'react';
import type { BeamModel, Reaction } from '@optisteel/core';

interface BeamSchematicProps {
  model: BeamModel;
  reactions?: Reaction[] | undefined;
}

export const BeamSchematic: React.FC<BeamSchematicProps> = ({ model, reactions = [] }) => {
  const L = Math.max(0.1, model.length);

  // SVG canvas dimensions with comfortable vertical spacing
  const width = 800;
  const height = 250;
  const paddingX = 65;
  const beamY = 105;
  const usableWidth = width - 2 * paddingX;

  const toSvgX = (x: number) => paddingX + (Math.max(0, Math.min(L, x)) / L) * usableWidth;

  return (
    <div className="diagram-container">
      <div className="diagram-header">
        <div className="diagram-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="4" rx="1" />
            <path d="M5 10v8m14-8v8M2 18h20" />
          </svg>
          Esquema Estructural de la Viga y Cargas
        </div>
        <span className="diagram-badge">L = {L.toFixed(2)} m</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="svg-responsive"
        aria-label="Representación esquemática de la viga, apoyos y cargas"
      >
        <defs>
          {/* Arrow markers */}
          <marker id="arrow-down" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 0 L 5 10 z" fill="#38bdf8" />
          </marker>
          <marker id="arrow-up" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 10 L 10 10 L 5 0 z" fill="#38bdf8" />
          </marker>
          <marker id="arrow-reaction" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 10 L 10 10 L 5 0 z" fill="#f59e0b" />
          </marker>
          <marker id="arrow-reaction-down" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 0 L 5 10 z" fill="#f59e0b" />
          </marker>
          <marker id="arrow-moment" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 10 L 10 10 L 5 0 z" fill="#c084fc" />
          </marker>
          <marker id="arrow-mr" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 10 L 10 10 L 5 0 z" fill="#f59e0b" />
          </marker>

          {/* Gradients */}
          <linearGradient id="beam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="dist-load-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
          </linearGradient>

          {/* Support Hatch Pattern */}
          <pattern id="hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* Distributed Loads */}
        {model.loads
          .filter((l) => l.type === 'distributed')
          .map((load) => {
            if (load.type !== 'distributed') return null;
            const x1 = toSvgX(load.xStart);
            const x2 = toSvgX(load.xEnd);
            const hStart = Math.min(48, Math.max(12, Math.abs(load.wStart) * 1.5));
            const hEnd = Math.min(48, Math.max(12, Math.abs(load.wEnd) * 1.5));
            const y1 = beamY - 6 - hStart;
            const y2 = beamY - 6 - hEnd;

            // Generate internal load arrows
            const arrowCount = Math.max(2, Math.round((x2 - x1) / 36));
            const arrows = [];
            for (let i = 0; i <= arrowCount; i++) {
              const ax = x1 + (i / arrowCount) * (x2 - x1);
              const fraction = i / arrowCount;
              const ay = y1 + fraction * (y2 - y1);
              arrows.push(
                <line
                  key={i}
                  x1={ax}
                  y1={ay}
                  x2={ax}
                  y2={beamY - 7}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  markerEnd="url(#arrow-down)"
                />
              );
            }

            return (
              <g key={load.id} className="load-distributed">
                <polygon
                  points={`${x1},${beamY - 6} ${x1},${y1} ${x2},${y2} ${x2},${beamY - 6}`}
                  fill="url(#dist-load-grad)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                {arrows}
                <text
                  x={(x1 + x2) / 2}
                  y={Math.min(y1, y2) - 8}
                  fill="#38bdf8"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {load.wStart === load.wEnd
                    ? `w = ${load.wStart} kN/m`
                    : `w = ${load.wStart} → ${load.wEnd} kN/m`}
                </text>
              </g>
            );
          })}

        {/* Beam Element Centerline Body */}
        <rect
          x={toSvgX(0)}
          y={beamY - 6}
          width={usableWidth}
          height="12"
          rx="2"
          fill="url(#beam-grad)"
          stroke="#334155"
          strokeWidth="1.5"
        />

        {/* Applied Point Loads */}
        {model.loads
          .filter((l) => l.type === 'point')
          .map((load) => {
            if (load.type !== 'point') return null;
            const sx = toSvgX(load.x);
            const isDown = load.P >= 0;
            const arrowLen = 38;
            const yStart = isDown ? beamY - 7 - arrowLen : beamY + 7 + arrowLen;
            const yEnd = isDown ? beamY - 7 : beamY + 7;
            const marker = isDown ? 'url(#arrow-down)' : 'url(#arrow-up)';

            return (
              <g key={load.id} className="load-point">
                <line
                  x1={sx}
                  y1={yStart}
                  x2={sx}
                  y2={yEnd}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  markerEnd={marker}
                />
                <circle cx={sx} cy={beamY} r="3" fill="#38bdf8" />
                <text
                  x={sx}
                  y={isDown ? yStart - 6 : yStart + 16}
                  fill="#38bdf8"
                  fontSize="10.5"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  fontWeight="700"
                >
                  P = {load.P} kN
                </text>
                <text
                  x={sx}
                  y={isDown ? yStart - 17 : yStart + 26}
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  x={load.x.toFixed(2)}m
                </text>
              </g>
            );
          })}

        {/* Applied Moments */}
        {model.loads
          .filter((l) => l.type === 'moment')
          .map((load) => {
            if (load.type !== 'moment') return null;
            const sx = toSvgX(load.x);
            const r = 20;
            const isCCW = load.M >= 0;
            const arcPath = isCCW
              ? `M ${sx - r} ${beamY} A ${r} ${r} 0 1 1 ${sx} ${beamY - r}`
              : `M ${sx + r} ${beamY} A ${r} ${r} 0 1 0 ${sx} ${beamY - r}`;

            return (
              <g key={load.id} className="load-moment">
                <circle cx={sx} cy={beamY} r="3.5" fill="#c084fc" />
                <path
                  d={arcPath}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="2.2"
                  markerEnd="url(#arrow-moment)"
                />
                <text
                  x={sx}
                  y={beamY - r - 8}
                  fill="#c084fc"
                  fontSize="10.5"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  fontWeight="700"
                >
                  M = {load.M} kN·m
                </text>
              </g>
            );
          })}

        {/* Supports */}
        {model.supports.map((sup) => {
          const sx = toSvgX(sup.x);

          if (sup.type === 'fixed') {
            // Empotramiento
            const isAtStart = sup.x <= L / 2;
            const wallW = 14;
            const wallH = 46;
            const wx = isAtStart ? sx - wallW : sx;
            return (
              <g key={sup.id} className="support-fixed">
                <rect
                  x={wx}
                  y={beamY - wallH / 2}
                  width={wallW}
                  height={wallH}
                  fill="url(#hatch)"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <line
                  x1={sx}
                  y1={beamY - wallH / 2}
                  x2={sx}
                  y2={beamY + wallH / 2}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <text
                  x={isAtStart ? sx - wallW / 2 : sx + wallW / 2}
                  y={beamY + wallH / 2 + 15}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {sup.label || `Empotre x=${sup.x}m`}
                </text>
              </g>
            );
          }

          if (sup.type === 'pin') {
            // Articulación (Pin)
            return (
              <g key={sup.id} className="support-pin">
                <polygon
                  points={`${sx},${beamY + 6} ${sx - 12},${beamY + 26} ${sx + 12},${beamY + 26}`}
                  fill="#1e293b"
                  stroke="#94a3b8"
                  strokeWidth="1.8"
                />
                <circle cx={sx} cy={beamY + 6} r="2.5" fill="#38bdf8" />
                <line x1={sx - 16} y1={beamY + 26} x2={sx + 16} y2={beamY + 26} stroke="#64748b" strokeWidth="2" />
                <rect x={sx - 16} y={beamY + 27} width="32" height="6" fill="url(#hatch)" />
                <text
                  x={sx}
                  y={beamY + 45}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {sup.label || `Pin x=${sup.x}m`}
                </text>
              </g>
            );
          }

          if (sup.type === 'roller') {
            // Rodillo
            return (
              <g key={sup.id} className="support-roller">
                <polygon
                  points={`${sx},${beamY + 6} ${sx - 12},${beamY + 22} ${sx + 12},${beamY + 22}`}
                  fill="#1e293b"
                  stroke="#94a3b8"
                  strokeWidth="1.8"
                />
                <circle cx={sx} cy={beamY + 6} r="2.5" fill="#10b981" />
                <circle cx={sx - 6} cy={beamY + 25} r="2.5" fill="#94a3b8" />
                <circle cx={sx + 6} cy={beamY + 25} r="2.5" fill="#94a3b8" />
                <line x1={sx - 16} y1={beamY + 28} x2={sx + 16} y2={beamY + 28} stroke="#64748b" strokeWidth="2" />
                <rect x={sx - 16} y={beamY + 29} width="32" height="6" fill="url(#hatch)" />
                <text
                  x={sx}
                  y={beamY + 47}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {sup.label || `Rodillo x=${sup.x}m`}
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* Reaction Vectors (Vertical Ry and Reaction Moment Mr) */}
        {reactions.map((r) => {
          const rx = toSvgX(r.x);
          const hasRy = Math.abs(r.Ry) > 1e-4;
          const hasMr = r.Mr !== undefined && Math.abs(r.Mr) > 1e-4;

          const isUp = r.Ry >= 0;
          const ryArrowStart = isUp ? beamY + 75 : beamY - 45;
          const ryArrowEnd = isUp ? beamY + 42 : beamY + 8;
          const marker = isUp ? 'url(#arrow-reaction)' : 'url(#arrow-reaction-down)';

          return (
            <g key={r.supportId} className="reaction-preview">
              {hasRy && (
                <>
                  <line
                    x1={rx}
                    y1={ryArrowStart}
                    x2={rx}
                    y2={ryArrowEnd}
                    stroke="#f59e0b"
                    strokeWidth="2.2"
                    strokeDasharray="3 2"
                    markerEnd={marker}
                  />
                  <text
                    x={rx}
                    y={isUp ? beamY + 89 : beamY - 50}
                    fill="#f59e0b"
                    fontSize="10.5"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    Ry = {r.Ry.toFixed(2)} kN
                  </text>
                </>
              )}

              {/* Reaction Moment Mr in Fixed Supports */}
              {hasMr && (
                <g className="reaction-moment">
                  <path
                    d={
                      r.Mr! >= 0
                        ? `M ${rx - 24} ${beamY} A 24 24 0 1 1 ${rx} ${beamY - 24}`
                        : `M ${rx + 24} ${beamY} A 24 24 0 1 0 ${rx} ${beamY - 24}`
                    }
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                    markerEnd="url(#arrow-mr)"
                  />
                  <text
                    x={rx}
                    y={beamY - 30}
                    fill="#f59e0b"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    Mr = {r.Mr!.toFixed(2)} kN·m
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Dimension Line at the bottom with clear margin */}
        <g className="dimension-line" opacity="0.8">
          <line x1={toSvgX(0)} y1={height - 14} x2={toSvgX(L)} y2={height - 14} stroke="#64748b" strokeWidth="1.2" />
          <line x1={toSvgX(0)} y1={height - 20} x2={toSvgX(0)} y2={height - 8} stroke="#64748b" strokeWidth="1.5" />
          <line x1={toSvgX(L)} y1={height - 20} x2={toSvgX(L)} y2={height - 8} stroke="#64748b" strokeWidth="1.5" />
          <text
            x={paddingX + usableWidth / 2}
            y={height - 4}
            fill="#94a3b8"
            fontSize="10.5"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            fontWeight="600"
          >
            L = {L.toFixed(2)} m
          </text>
        </g>
      </svg>
    </div>
  );
};
