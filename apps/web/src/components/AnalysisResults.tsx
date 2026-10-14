import React, { useState } from 'react';
import type { BeamAnalysisResult, PointLoad, MomentLoad } from '@optisteel/core';
import { DiagramChart } from './DiagramChart.js';

interface AnalysisResultsProps {
  analysis: BeamAnalysisResult;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis }) => {
  const { model, reactions, equilibrium, shear, moment, deflection } = analysis;
  const L = model.length;
  const [showCriticalPoints, setShowCriticalPoints] = useState(false);

  const isDeflectionCalculated = deflection.isImplemented;

  // Tolerances for physical and coordinate classifications
  const POS_TOL = 1e-3;      // 1 mm along beam axis
  const MOMENT_TOL = 1e-3;   // 0.001 kN*m for bending moment
  const FORCE_TOL = 1e-3;    // 0.001 kN for shear force
  const DEF_TOL = 1e-5;      // 0.01 mm (1e-5 m) for deflection
  const SLOPE_TOL = 1e-4;    // 0.0001 rad for slope

  // Collect, merge, and sort all unique critical x positions for the tabular summary
  const tablePoints = React.useMemo(() => {
    const coordsSet = new Set<number>([0, L]);
    shear.criticalPoints.forEach((p) => coordsSet.add(Number(p.x.toFixed(4))));
    moment.criticalPoints.forEach((p) => coordsSet.add(Number(p.x.toFixed(4))));
    if (isDeflectionCalculated) {
      deflection.criticalPoints.forEach((p) => coordsSet.add(Number(p.x.toFixed(4))));
    }
    reactions.forEach((r) => coordsSet.add(Number(r.x.toFixed(4))));
    model.supports.forEach((s) => coordsSet.add(Number(s.x.toFixed(4))));
    model.loads.forEach((l) => {
      if (l.type === 'point' || l.type === 'moment') {
        coordsSet.add(Number(l.x.toFixed(4)));
      } else if (l.type === 'distributed') {
        coordsSet.add(Number(l.xStart.toFixed(4)));
        coordsSet.add(Number(l.xEnd.toFixed(4)));
      }
    });

    const rawCoords = Array.from(coordsSet)
      .filter((x) => x >= -1e-5 && x <= L + 1e-5)
      .map((x) => Math.max(0, Math.min(L, x)))
      .sort((a, b) => a - b);

    // Merge coordinates that are within POS_TOL to prevent duplicate rows
    const sortedCoords: number[] = [];
    for (const cx of rawCoords) {
      if (
        sortedCoords.length === 0 ||
        Math.abs(cx - sortedCoords[sortedCoords.length - 1]!) > POS_TOL
      ) {
        sortedCoords.push(cx);
      }
    }

    const hasPositiveMoment = moment.maxPositive.value > MOMENT_TOL;
    const hasNegativeMoment = moment.maxNegative.value < -MOMENT_TOL;

    return sortedCoords.map((x) => {
      const vVal = shear.evaluate(x);
      const mVal = moment.evaluate(x);
      const yVal = isDeflectionCalculated ? deflection.evaluate(x) * 1000 : undefined;

      const descParts: string[] = [];

      // 1. Extremo de viga
      const isLeftEnd = x <= POS_TOL;
      const isRightEnd = Math.abs(x - L) <= POS_TOL;
      if (isLeftEnd) descParts.push('Extremo Izquierdo (x=0)');
      if (isRightEnd) descParts.push(`Extremo Derecho (x=${L}m)`);

      // 2. Apoyo
      const sup = model.supports.find((s) => Math.abs(s.x - x) <= POS_TOL);
      if (sup) descParts.push(`Apoyo ${sup.id} (${sup.type.toUpperCase()})`);

      // 3. Punto de aplicación de carga puntual o momento concentrado
      const ptLoads = model.loads.filter(
        (l): l is PointLoad => l.type === 'point' && Math.abs(l.x - x) <= POS_TOL
      );
      ptLoads.forEach((l) => descParts.push(`Carga Puntual P=${l.P} kN`));

      const momLoads = model.loads.filter(
        (l): l is MomentLoad => l.type === 'moment' && Math.abs(l.x - x) <= POS_TOL
      );
      momLoads.forEach((l) => descParts.push(`Momento Aplicado M=${l.M} kN·m`));

      // 4. Cortante: Cruce por cero (pico de momento en vano interior)
      if (Math.abs(vVal) <= FORCE_TOL && !isLeftEnd && !isRightEnd) {
        descParts.push('V = 0 (Pico M)');
      }

      // 5. Momento flector: distinción rigurosa entre máx positivo, máx negativo y momento nulo
      const isZeroMoment = Math.abs(mVal) <= MOMENT_TOL;
      const isGlobalMaxPositive =
        hasPositiveMoment && Math.abs(mVal - moment.maxPositive.value) <= MOMENT_TOL;
      const isGlobalMaxNegative =
        hasNegativeMoment && Math.abs(mVal - moment.maxNegative.value) <= MOMENT_TOL;

      if (isGlobalMaxPositive) {
        descParts.push('M Máx Positivo');
      } else if (isGlobalMaxNegative) {
        descParts.push('M Máx Negativo');
      } else if (isZeroMoment) {
        if (!isLeftEnd && !isRightEnd) {
          descParts.push('Punto de Inflexión (M=0)');
        } else {
          descParts.push('M = 0');
        }
      }

      // 6. Deflexión elástica: posición de flecha extrema o estacionaria
      if (isDeflectionCalculated) {
        const isMaxDownward =
          deflection.maxDownward.value > DEF_TOL &&
          Math.abs(x - deflection.maxDownward.x) <= POS_TOL;
        const isMaxUpward =
          deflection.maxUpward.value < -DEF_TOL &&
          Math.abs(x - deflection.maxUpward.x) <= POS_TOL;
        const isMaxAbsolute =
          deflection.maxAbsolute.value > DEF_TOL &&
          Math.abs(x - deflection.maxAbsolute.x) <= POS_TOL;

        if (isMaxAbsolute) {
          if (isMaxDownward) {
            descParts.push('Deflexión Máxima |δ| (Descendente)');
          } else if (isMaxUpward) {
            descParts.push('Deflexión Máxima |δ| (Levantamiento)');
          }
        } else if (isMaxDownward) {
          descParts.push('Flecha Máx Descendente');
        } else if (isMaxUpward) {
          descParts.push('Flecha Máx Ascendente');
        } else if (
          !isLeftEnd &&
          !isRightEnd &&
          Math.abs(deflection.evaluateSlope(x)) <= SLOPE_TOL
        ) {
          descParts.push('θ = 0 (Pico Flecha)');
        }
      }

      return {
        x,
        v: vVal,
        m: mVal,
        y: yVal,
        desc: descParts.join(' • ') || 'Punto Interior',
      };
    });
  }, [L, shear, moment, deflection, reactions, model, isDeflectionCalculated]);

  return (
    <div className="analysis-results">
      {/* 1. Executive Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Cortante Máximo |V|</span>
          <span className="metric-value">{shear.maxAbsolute.value.toFixed(2)} kN</span>
          <span className="metric-sub">en x = {shear.maxAbsolute.x.toFixed(2)} m</span>
        </div>

        <div className="metric-card emerald">
          <span className="metric-label">Momento Positivo Máx (M+)</span>
          <span className="metric-value">{moment.maxPositive.value.toFixed(2)} kN·m</span>
          <span className="metric-sub">en x = {moment.maxPositive.x.toFixed(2)} m</span>
        </div>

        <div className="metric-card amber">
          <span className="metric-label">Momento Negativo Máx (M-)</span>
          <span className="metric-value">{moment.maxNegative.value.toFixed(2)} kN·m</span>
          <span className="metric-sub">en x = {moment.maxNegative.x.toFixed(2)} m</span>
        </div>

        <div className="metric-card purple">
          <span className="metric-label">Deflexión Máxima |δ|</span>
          {isDeflectionCalculated ? (
            <>
              <span className="metric-value">
                {(deflection.maxAbsolute.value * 1000).toFixed(2)} mm
              </span>
              <span className="metric-sub">
                en x = {deflection.maxAbsolute.x.toFixed(2)} m (
                {deflection.maxAbsolute.value === deflection.maxDownward.value
                  ? '↓ Descenso'
                  : '↑ Levantamiento'}
                )
              </span>
            </>
          ) : (
            <>
              <span className="metric-value" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                No disponible
              </span>
              <span className="metric-sub">Requiere material E e inercia Iz</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Support Reactions & Static Equilibrium */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <h3 className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Reacciones en los Apoyos y Equilibrio Estático
          </h3>
          <span
            className="diagram-badge"
            style={{
              color: equilibrium.isBalanced ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              borderColor: equilibrium.isBalanced ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
            }}
          >
            {equilibrium.isBalanced ? '✓ Equilibrio Verificado' : '⚠ Desequilibrio detectado'}
          </span>
        </div>

        <div className="table-wrapper">
          <table className="eng-table">
            <thead>
              <tr>
                <th>Apoyo</th>
                <th>Tipo</th>
                <th>Posición x (m)</th>
                <th>Fuerza Vertical Ry (kN)</th>
                <th>Momento Mr (kN·m)</th>
              </tr>
            </thead>
            <tbody>
              {reactions.map((r) => (
                <tr key={r.supportId}>
                  <td><strong>{r.supportId}</strong></td>
                  <td>{r.supportType.toUpperCase()}</td>
                  <td>{r.x.toFixed(2)}</td>
                  <td style={{ color: r.Ry >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                    {r.Ry >= 0 ? `+${r.Ry.toFixed(3)}` : r.Ry.toFixed(3)} kN {r.Ry >= 0 ? '(↑)' : '(↓)'}
                  </td>
                  <td>
                    {r.Mr !== undefined ? (
                      <span style={{ color: '#c084fc', fontWeight: 600 }}>
                        {r.Mr.toFixed(3)} kN·m {r.Mr >= 0 ? '(↺ CCW)' : '(↻ CW)'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="equilibrium-summary">
          <span>Σ Fy = {equilibrium.sumFy.toFixed(4)} kN</span>
          <span>Σ M (x=0) = {equilibrium.sumM.toFixed(4)} kN·m</span>
          <span>Tolerancia de Equilibrio = {equilibrium.toleranceForce} kN</span>
        </div>
      </div>

      {/* 3. Internal Shear Force Diagram V(x) */}
      <DiagramChart
        title="Diagrama de Fuerza Cortante V(x)"
        unit="kN"
        length={L}
        evaluate={(x, side) => shear.evaluate(x, side)}
        criticalPoints={shear.criticalPoints}
        discontinuities={shear.discontinuities}
        maxExtremum={shear.maxPositive}
        minExtremum={shear.maxNegative}
        colorTheme="cyan"
      />

      {/* 4. Internal Bending Moment Diagram M(x) */}
      <DiagramChart
        title="Diagrama de Momento Flector M(x)"
        unit="kN·m"
        length={L}
        evaluate={(x, side) => moment.evaluate(x, side)}
        criticalPoints={moment.criticalPoints}
        discontinuities={moment.discontinuities}
        maxExtremum={moment.maxPositive}
        minExtremum={moment.maxNegative}
        colorTheme="emerald"
      />

      {/* 5. Deflection & Elastic Curve y(x) */}
      {isDeflectionCalculated ? (
        <>
          <DiagramChart
            title="Curva Elástica de Deflexión y(x) — Positiva hacia abajo (↓)"
            unit="mm"
            length={L}
            evaluate={(x) => deflection.evaluate(x) * 1000} // Convert m to mm
            criticalPoints={deflection.criticalPoints.map((pt) => ({
              ...pt,
              value: pt.value * 1000,
            }))}
            maxExtremum={{
              x: deflection.maxDownward.x,
              value: deflection.maxDownward.value * 1000,
            }}
            minExtremum={{
              x: deflection.maxUpward.x,
              value: deflection.maxUpward.value * 1000,
            }}
            invertYAxis={true}
            colorTheme="purple"
          />

          <div className="glass-panel" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Pendientes en los Extremos (Giro de la Elástica θ):
            </h4>
            <div className="slopes-grid">
              <div>
                Extremo Izquierdo θ(0):{' '}
                <strong style={{ color: '#38bdf8' }}>
                  {deflection.endSlopes.thetaLeft.toFixed(6)} rad (
                  {((deflection.endSlopes.thetaLeft * 180) / Math.PI).toFixed(4)}°)
                </strong>
              </div>
              <div>
                Extremo Derecho θ(L):{' '}
                <strong style={{ color: '#38bdf8' }}>
                  {deflection.endSlopes.thetaRight.toFixed(6)} rad (
                  {((deflection.endSlopes.thetaRight * 180) / Math.PI).toFixed(4)}°)
                </strong>
              </div>
              <div>
                Rigidez Flexionante EI:{' '}
                <strong style={{ color: '#c084fc' }}>
                  {deflection.EI.toFixed(0)} kN·m²
                </strong>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <div>
            <strong>Cálculo de Deformaciones no activo:</strong> {deflection.note}
          </div>
        </div>
      )}

      {/* 6. Summary Table of Critical Points */}
      <div className="glass-panel">
        <div className="panel-header" style={{ marginBottom: showCriticalPoints ? '1rem' : '0' }}>
          <h3 className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" />
            </svg>
            Tabla de Puntos Notables y Secciones Críticas ({tablePoints.length})
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCriticalPoints(!showCriticalPoints)}
          >
            {showCriticalPoints ? 'Ocultar Tabla' : 'Ver Tabla Completa'}
          </button>
        </div>

        {showCriticalPoints && (
          <div className="table-wrapper">
            <table className="eng-table">
              <thead>
                <tr>
                  <th>Posición x (m)</th>
                  <th>Cortante V (kN)</th>
                  <th>Momento M (kN·m)</th>
                  {isDeflectionCalculated && <th>Deflexión y (mm)</th>}
                  <th>Descripción del Punto Crítico</th>
                </tr>
              </thead>
              <tbody>
                {tablePoints.map((pt, idx) => (
                  <tr key={idx}>
                    <td><strong>{pt.x.toFixed(3)}</strong></td>
                    <td style={{ color: Math.abs(pt.v) < 1e-4 ? 'var(--text-dim)' : pt.v >= 0 ? '#38bdf8' : '#f43f5e' }}>
                      {pt.v.toFixed(3)}
                    </td>
                    <td style={{ color: Math.abs(pt.m) < 1e-4 ? 'var(--text-dim)' : pt.m >= 0 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                      {pt.m.toFixed(3)}
                    </td>
                    {isDeflectionCalculated && (
                      <td style={{ color: pt.y !== undefined && pt.y > 0 ? '#c084fc' : '#38bdf8' }}>
                        {pt.y !== undefined ? pt.y.toFixed(3) : '—'}
                      </td>
                    )}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{pt.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
