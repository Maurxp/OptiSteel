import React, { useState } from 'react';
import type { BeamAnalysisResult } from '@optisteel/core';

interface MaterialsMechanicsPanelProps {
  analysis: BeamAnalysisResult;
}

type MechanicsTab = 'bending' | 'shear' | 'elasticCurve' | 'deflection';

export const MaterialsMechanicsPanel: React.FC<MaterialsMechanicsPanelProps> = ({ analysis }) => {
  const mechanics = analysis.mechanics;
  const [activeTab, setActiveTab] = useState<MechanicsTab>('bending');
  const [viewAll, setViewAll] = useState<boolean>(false);

  if (!mechanics) {
    return null;
  }

  const { bending, shear, elasticCurve, deflection } = mechanics;

  return (
    <div className="glass-panel materials-mechanics-panel" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Header with Title and Mode Toggles */}
      <div className="panel-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                fontWeight: 700,
              }}
            >
              Mecánica de Materiales
            </span>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.4)',
              }}
            >
              Navier • Jourawski • Euler-Bernoulli
            </span>
          </div>
          <h3 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
            Resultados de Resistencia de Materiales y Desarrollo Matemático
          </h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Análisis riguroso de esfuerzos seccionales, distribución tangencial, ecuaciones polinómicas de elástica y verificación de servicio.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setViewAll(!viewAll)}
            title={viewAll ? 'Cambiar a vista por pestañas' : 'Ver todas las secciones a la vez'}
          >
            {viewAll ? 'Vista por Pestañas' : 'Ver Todo Desplegado'}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      {!viewAll && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.75rem 0',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'bending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('bending')}
          >
            Flexión Normal (σ)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'shear' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('shear')}
          >
            Cortante Seccional (τ)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'elasticCurve' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('elasticCurve')}
          >
            Ecuación de la Curva Elástica
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'deflection' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('deflection')}
          >
            Deformaciones y ELS
          </button>
        </div>
      )}

      {/* 1. BENDING STRESS PANEL */}
      {(viewAll || activeTab === 'bending') && (
        <div className="mechanics-section" style={{ marginBottom: viewAll ? '2rem' : '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📐</span> Esfuerzo Normal por Flexión (Fórmula de Navier)
            </h4>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: bending.status === 'calculated' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: bending.status === 'calculated' ? '#10b981' : '#f59e0b',
                borderColor: bending.status === 'calculated' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              }}
            >
              {bending.status === 'calculated' ? '✓ Cálculo Completo' : '⚠ Información Parcial'}
            </span>
          </div>

          {/* Mathematical Formulation and Substitution Box */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: '#94a3b8', marginBottom: '0.35rem' }}>
              <strong>Ecuación Gobernante:</strong> {bending.formula}
            </div>
            <div style={{ color: '#38bdf8', fontWeight: 600 }}>
              <strong>Sustitución Numérica:</strong> {bending.substitution}
            </div>
          </div>

          {/* Key Bending Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div className="metric-card">
              <span className="metric-label">Demanda Momento Máx |M|</span>
              <span className="metric-value">{bending.maxMomentDemandKNm.toFixed(2)} kN·m</span>
              <span className="metric-sub">
                en x = {bending.maxMomentLocationM.toFixed(3)} m (
                {bending.momentType === 'positive'
                  ? 'Positivo • Tracción inf.'
                  : bending.momentType === 'negative'
                  ? 'Negativo • Tracción sup.'
                  : 'Nulo'}
                )
              </span>
            </div>

            <div className="metric-card emerald">
              <span className="metric-label">Módulo Elástico (S / Wz)</span>
              <span className="metric-value">
                {bending.sectionModulusCm3 !== undefined
                  ? `${bending.sectionModulusCm3.toFixed(2)} cm³`
                  : 'No disponible'}
              </span>
              <span className="metric-sub">
                Iz = {bending.momentOfInertiaCm4.toFixed(1)} cm⁴
                {bending.distanceToExtremeFiberMm ? ` • c = ${bending.distanceToExtremeFiberMm.toFixed(1)} mm` : ''}
              </span>
            </div>

            <div className="metric-card purple">
              <span className="metric-label">Esfuerzo Máximo σ_máx</span>
              <span className="metric-value" style={{ color: '#c084fc' }}>
                {bending.actualStressMPa !== undefined
                  ? `${bending.actualStressMPa.toFixed(2)} MPa`
                  : 'No calculable'}
              </span>
              <span className="metric-sub">
                {bending.actualStressMPa !== undefined
                  ? `|M| / S = ${(bending.actualStressMPa * 10).toFixed(1)} kg/cm²`
                  : 'Requiere peralte h o Wz'}
              </span>
            </div>

            {bending.allowableStressMPa !== undefined && (
              <div className={`metric-card ${bending.utilizationRatio && bending.utilizationRatio <= 1 ? 'emerald' : 'rose'}`}>
                <span className="metric-label">Verificación Admisible</span>
                <span className="metric-value" style={{ color: bending.utilizationRatio && bending.utilizationRatio <= 1 ? '#10b981' : '#f43f5e' }}>
                  {bending.utilizationRatio ? `${(bending.utilizationRatio * 100).toFixed(1)}%` : '—'}
                </span>
                <span className="metric-sub">
                  σ_adm = {bending.allowableStressMPa.toFixed(1)} MPa
                  {bending.safetyFactor ? ` • FS = ${bending.safetyFactor.toFixed(2)}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Dual Peak Extrema (Positive and Negative Moments) */}
          {bending.positiveExtremum && bending.negativeExtremum && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', marginBottom: '0.35rem' }}>
                  Extremo de Flexión Positiva (M+)
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Momento: <strong>+{bending.positiveExtremum.momentKNm.toFixed(2)} kN·m</strong> en x = {bending.positiveExtremum.locationM.toFixed(2)} m
                </div>
                <div style={{ fontSize: '0.82rem', color: '#c084fc', marginBottom: '0.2rem' }}>
                  Esfuerzo: <strong>{bending.positiveExtremum.actualStressMPa?.toFixed(2)} MPa</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Fibra sup: Compresión (-) • Fibra inf: Tracción (+)
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.35rem' }}>
                  Extremo de Flexión Negativa (M-)
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Momento: <strong>{bending.negativeExtremum.momentKNm.toFixed(2)} kN·m</strong> en x = {bending.negativeExtremum.locationM.toFixed(2)} m
                </div>
                <div style={{ fontSize: '0.82rem', color: '#c084fc', marginBottom: '0.2rem' }}>
                  Esfuerzo: <strong>{bending.negativeExtremum.actualStressMPa?.toFixed(2)} MPa</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Fibra sup: Tracción (+) • Fibra inf: Compresión (-)
                </div>
              </div>
            </div>
          )}

          {/* Fiber States Diagram & Explanation */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Estado Tensional de Fibras Extremas en Sección Gobernante (x = {bending.maxMomentLocationM.toFixed(3)} m):
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fibra Superior:</span>
                <span
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: bending.extremeFibers.top === 'tension' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: bending.extremeFibers.top === 'tension' ? '#10b981' : '#38bdf8',
                    border: `1px solid ${bending.extremeFibers.top === 'tension' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                  }}
                >
                  {bending.extremeFibers.top === 'tension' ? 'Tracción (+)' : bending.extremeFibers.top === 'compression' ? 'Compresión (-)' : 'Neutro'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fibra Inferior:</span>
                <span
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: bending.extremeFibers.bottom === 'tension' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: bending.extremeFibers.bottom === 'tension' ? '#10b981' : '#38bdf8',
                    border: `1px solid ${bending.extremeFibers.bottom === 'tension' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                  }}
                >
                  {bending.extremeFibers.bottom === 'tension' ? 'Tracción (+)' : bending.extremeFibers.bottom === 'compression' ? 'Compresión (-)' : 'Neutro'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              {bending.extremeFibers.explanation}
            </div>
          </div>

          {/* Notes */}
          {bending.notes.length > 0 && (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {bending.notes.map((n, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 2. SHEAR STRESS PANEL */}
      {(viewAll || activeTab === 'shear') && (
        <div className="mechanics-section" style={{ marginBottom: viewAll ? '2rem' : '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚡</span> Esfuerzo Cortante (Fórmula de Jourawski / Colignon)
            </h4>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: shear.status === 'calculated' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: shear.status === 'calculated' ? '#10b981' : '#38bdf8',
                borderColor: shear.status === 'calculated' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)',
              }}
            >
              {shear.calculationMethod === 'jourawski_neutral_axis'
                ? 'Perfil I / W (τmáx — Jourawski en eje neutro)'
                : shear.calculationMethod === 'web_average'
                ? 'Perfil I / W (Cortante medio en alma d·tw)'
                : shear.shearDistributionType === 'rectangular'
                ? 'Sección Rectangular (τmáx = 1.5 τ_prom)'
                : shear.shearDistributionType === 'circular'
                ? 'Sección Circular (τmáx = 4/3 τ_prom)'
                : shear.shearDistributionType === 'average_only'
                ? 'Esfuerzo Promedio V/A'
                : 'Sin Datos de Sección'}
            </span>
          </div>

          {/* Mathematical Formulations Box */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: '#94a3b8', marginBottom: '0.35rem' }}>
              <strong>Cortante Promedio:</strong> {shear.averageFormula} &nbsp;➜&nbsp;{' '}
              <span style={{ color: '#38bdf8' }}>{shear.averageSubstitution}</span>
            </div>
            {shear.maxFormula && shear.maxSubstitution && (
              <div style={{ color: '#94a3b8' }}>
                <strong>Cortante Máximo Real:</strong> {shear.maxFormula} &nbsp;➜&nbsp;{' '}
                <span style={{ color: '#10b981', fontWeight: 600 }}>{shear.maxSubstitution}</span>
              </div>
            )}
          </div>

          {/* Shear Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div className="metric-card">
              <span className="metric-label">Demanda Cortante Máx |V|</span>
              <span className="metric-value">{shear.maxShearDemandKN.toFixed(2)} kN</span>
              <span className="metric-sub">en x = {shear.maxShearLocationM.toFixed(3)} m</span>
            </div>

            <div className="metric-card amber">
              <span className="metric-label">Área Resistente (A)</span>
              <span className="metric-value">
                {shear.crossSectionAreaCm2 !== undefined
                  ? `${shear.crossSectionAreaCm2.toFixed(2)} cm²`
                  : 'No disponible'}
              </span>
              <span className="metric-sub">
                {shear.crossSectionAreaCm2 !== undefined
                  ? `${(shear.crossSectionAreaCm2 * 100).toFixed(0)} mm²`
                  : 'Requiere dimensiones o área'}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Cortante Promedio (τ_prom)</span>
              <span className="metric-value">
                {shear.averageShearStressMPa !== undefined
                  ? `${shear.averageShearStressMPa.toFixed(2)} MPa`
                  : 'No disponible'}
              </span>
              <span className="metric-sub">
                {shear.averageFormula.includes('alma')
                  ? 'τ_alma_prom = |V| / (d·tw)'
                  : 'τ_prom = |V| / A'}
              </span>
            </div>

            <div className="metric-card emerald">
              <span className="metric-label">Cortante Máximo (τ_máx)</span>
              <span className="metric-value" style={{ color: shear.maxShearStressMPa !== undefined ? '#10b981' : 'var(--text-muted)' }}>
                {shear.maxShearStressMPa !== undefined
                  ? `${shear.maxShearStressMPa.toFixed(2)} MPa`
                  : 'Ver nota didáctica'}
              </span>
              <span className="metric-sub">
                {shear.calculationMethod === 'jourawski_neutral_axis'
                  ? 'τmáx — Jourawski en eje neutro'
                  : shear.shearDistributionType === 'rectangular'
                  ? 'τmáx — Rectangular 1.5·V/A'
                  : shear.shearDistributionType === 'circular'
                  ? 'τmáx — Circular 4/3·V/A'
                  : 'Requiere modelo geométrico'}
              </span>
            </div>
          </div>

          {/* Didactic Rigor Notice on Shear Stress */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Didáctica Estructural de Esfuerzos Cortantes:
            </div>
            La fórmula elemental τ = V/A solo representa un promedio espacial. En vigas prismáticas según la formulación de Jourawski (τ = V·Q / (I·b)), el esfuerzo cortante es nulo en las fibras extremas superior e inferior y alcanza su valor máximo en el eje neutro (para secciones rectangulares τ_máx = 1.5·τ_prom; para circulares τ_máx = 4/3·τ_prom; en perfiles I el alma absorbe aproximadamente el 90-95% del cortante total).
          </div>

          {/* Notes */}
          {shear.notes.length > 0 && (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {shear.notes.map((n, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 3. ELASTIC CURVE PANEL */}
      {(viewAll || activeTab === 'elasticCurve') && (
        <div className="mechanics-section" style={{ marginBottom: viewAll ? '2rem' : '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>∫</span> Ecuación Diferencial de la Curva Elástica (Euler-Bernoulli)
            </h4>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                borderColor: 'rgba(168, 85, 247, 0.4)',
              }}
            >
              {elasticCurve.status === 'exact_analytical'
                ? 'Integración Exacta'
                : elasticCurve.status === 'numerical'
                ? 'Solución Numérica'
                : 'Sin Parámetros Elásticos'}
            </span>
          </div>

          {/* Differential Formulations */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong style={{ color: '#c084fc' }}>Ecuación Diferencial de 2° Orden:</strong> {elasticCurve.differentialEquation}
            </div>
            <div>
              <strong style={{ color: '#38bdf8' }}>Primera Integración (Giro / Pendiente):</strong> {elasticCurve.slopeIntegralEquation}
            </div>
            <div>
              <strong style={{ color: '#10b981' }}>Segunda Integración (Deflexión):</strong> {elasticCurve.deflectionIntegralEquation}
            </div>
            {elasticCurve.flexuralRigidityEI && (
              <div style={{ marginTop: '0.35rem', color: '#f1f5f9' }}>
                <strong>Rigidez Flexionante EI:</strong> {elasticCurve.flexuralRigidityEI.toFixed(1)} kN·m²
              </div>
            )}
          </div>

          {/* Boundary Conditions & Integration Constants */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            {/* Boundary conditions list */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Condiciones de Frontera Físicas:
              </div>
              {elasticCurve.boundaryConditions.length > 0 ? (
                <div className="table-wrapper">
                  <table className="eng-table" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th>Ubicación x</th>
                        <th>Condición Cinemática</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elasticCurve.boundaryConditions.map((bc, idx) => (
                        <tr key={idx}>
                          <td><strong>{bc.locationM.toFixed(2)} m</strong></td>
                          <td style={{ color: '#38bdf8' }}>{bc.mathematicalForm}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{bc.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Condiciones cinemáticas determinadas por los apoyos de la viga.
                </span>
              )}
            </div>

            {/* Integration Constants */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Constantes Globales de Integración:
              </div>
              {elasticCurve.integrationConstants ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>C₁ = {elasticCurve.integrationConstants.C1.toExponential(4)}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {elasticCurve.integrationConstants.descriptionC1}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>C₂ = {elasticCurve.integrationConstants.C2.toExponential(4)}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {elasticCurve.integrationConstants.descriptionC2}
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Las constantes C₁ y C₂ se resuelven mediante el sistema de ecuaciones de compatibilidad elástica.
                </span>
              )}
            </div>
          </div>

          {/* Piecewise Segment Equations */}
          {elasticCurve.segments.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Ecuaciones Analíticas por Tramos de Continuidad:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {elasticCurve.segments.map((seg) => (
                  <div
                    key={seg.segmentIndex}
                    style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: '#94a3b8' }}>
                      <strong>
                        Tramo {seg.segmentIndex}: x ∈ [{seg.xStart.toFixed(2)} m, {seg.xEnd.toFixed(2)} m] &nbsp;(L = {seg.spanM.toFixed(2)} m)
                      </strong>
                      <span style={{ color: 'var(--text-dim)' }}>{seg.localCoordinateNote}</span>
                    </div>
                    <div style={{ color: '#10b981' }}>
                      M(ξ) = {seg.momentEquation} &nbsp;[kN·m]
                    </div>
                    <div style={{ color: '#38bdf8' }}>
                      EI·θ(ξ) = {seg.slopeEquation} &nbsp;[kN·m²]
                    </div>
                    <div style={{ color: '#c084fc' }}>
                      EI·v(ξ) = {seg.deflectionEquation} &nbsp;[kN·m³]
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. DEFLECTION & SERVICEABILITY PANEL */}
      {(viewAll || activeTab === 'deflection') && (
        <div className="mechanics-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📉</span> Deformación Máxima y Estado Límite de Servicio (ELS)
            </h4>
            {deflection.serviceCheckStatus && (
              <span
                className="diagram-badge"
                style={{
                  backgroundColor: deflection.serviceCheckStatus === 'passed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: deflection.serviceCheckStatus === 'passed' ? '#10b981' : '#f43f5e',
                  borderColor: deflection.serviceCheckStatus === 'passed' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
                  fontWeight: 700,
                }}
              >
                {deflection.serviceCheckStatus === 'passed' ? '✓ CUMPLE ELS' : '⚠ EXCEDE FLECHA ADMISIBLE'}
              </span>
            )}
          </div>

          {/* Deflection Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div className="metric-card purple">
              <span className="metric-label">Flecha Absoluta Máxima |δ|</span>
              <span className="metric-value">
                {deflection.maxAbsoluteDeflectionMm !== undefined
                  ? `${deflection.maxAbsoluteDeflectionMm.toFixed(2)} mm`
                  : 'No disponible'}
              </span>
              <span className="metric-sub">
                {deflection.maxAbsoluteLocationM !== undefined
                  ? `en x = ${deflection.maxAbsoluteLocationM.toFixed(3)} m`
                  : ''}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Flecha Descendente (↓)</span>
              <span className="metric-value">
                {deflection.maxDownwardDeflectionMm !== undefined && deflection.maxDownwardDeflectionMm > 1e-4
                  ? `${deflection.maxDownwardDeflectionMm.toFixed(2)} mm`
                  : '0.00 mm'}
              </span>
              <span className="metric-sub">
                {deflection.maxDownwardLocationM !== undefined
                  ? `en x = ${deflection.maxDownwardLocationM.toFixed(3)} m`
                  : ''}
              </span>
            </div>

            <div className="metric-card amber">
              <span className="metric-label">Levantamiento (↑)</span>
              <span className="metric-value">
                {deflection.maxUpwardDeflectionMm !== undefined && Math.abs(deflection.maxUpwardDeflectionMm) > 1e-4
                  ? `${Math.abs(deflection.maxUpwardDeflectionMm).toFixed(2)} mm`
                  : '0.00 mm'}
              </span>
              <span className="metric-sub">
                {deflection.maxUpwardLocationM !== undefined && Math.abs(deflection.maxUpwardDeflectionMm || 0) > 1e-4
                  ? `en x = ${deflection.maxUpwardLocationM.toFixed(3)} m`
                  : 'Sin levantamiento significativo'}
              </span>
            </div>

            <div className={`metric-card ${deflection.serviceCheckStatus === 'passed' ? 'emerald' : 'rose'}`}>
              <span className="metric-label">Límite ELS ({deflection.referenceSpanDescription ? 'Vano' : 'L'}/{deflection.serviceLimitDenominator || 360})</span>
              <span className="metric-value">
                {deflection.allowableDeflectionMm !== undefined
                  ? `${deflection.allowableDeflectionMm.toFixed(2)} mm`
                  : '—'}
              </span>
              <span className="metric-sub">
                {deflection.deflectionUtilizationRatio !== undefined
                  ? `Uso: ${(deflection.deflectionUtilizationRatio * 100).toFixed(1)}%`
                  : ''}
                {deflection.referenceLengthM ? ` • L_ref = ${deflection.referenceLengthM.toFixed(2)} m` : ''}
              </span>
            </div>
          </div>

          {/* Span-by-span evaluation breakdown for multi-span or overhang configurations */}
          {deflection.spanEvaluations && deflection.spanEvaluations.length > 1 && (
            <div style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.45rem' }}>
                Verificación Individual de Flecha por Vanos y Voladizos ({deflection.spanEvaluations.length} sectores):
              </div>
              <div className="table-wrapper">
                <table className="eng-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Sector / Vano</th>
                      <th>Tipo</th>
                      <th>Intervalo x (m)</th>
                      <th>Luz Ref. (m)</th>
                      <th>|v_máx| (mm)</th>
                      <th>δ_adm (mm)</th>
                      <th>Uso (%)</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deflection.spanEvaluations.map((se) => (
                      <tr key={se.spanIndex}>
                        <td><strong>{se.description}</strong></td>
                        <td>{se.spanType === 'cantilever' ? 'Voladizo' : 'Vano entre apoyos'}</td>
                        <td>[{se.xStart.toFixed(2)}, {se.xEnd.toFixed(2)}]</td>
                        <td>{se.referenceLengthM.toFixed(2)} m</td>
                        <td style={{ color: '#c084fc' }}>{se.maxDeflectionMm.toFixed(2)}</td>
                        <td>{se.allowableDeflectionMm.toFixed(2)}</td>
                        <td style={{ color: se.passesService ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                          {(se.utilizationRatio * 100).toFixed(1)}%
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: se.passesService ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                              color: se.passesService ? '#10b981' : '#f43f5e',
                            }}
                          >
                            {se.passesService ? 'CUMPLE' : 'EXCEDE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Critical Deflection Points Summary */}
          {deflection.criticalPointsSummary.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Puntos Notables de la Elástica:
              </div>
              <div className="table-wrapper">
                <table className="eng-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Posición x (m)</th>
                      <th>Deflexión y (mm)</th>
                      <th>Sentido Físico</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deflection.criticalPointsSummary.map((pt, idx) => (
                      <tr key={idx}>
                        <td><strong>{pt.x.toFixed(3)}</strong></td>
                        <td style={{ color: pt.deflectionMm > 0 ? '#c084fc' : pt.deflectionMm < 0 ? '#38bdf8' : 'var(--text-dim)' }}>
                          {pt.deflectionMm.toFixed(3)}
                        </td>
                        <td>
                          {pt.deflectionMm > 1e-4
                            ? '↓ Descenso'
                            : pt.deflectionMm < -1e-4
                            ? '↑ Levantamiento'
                            : '— Nulo'}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{pt.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
