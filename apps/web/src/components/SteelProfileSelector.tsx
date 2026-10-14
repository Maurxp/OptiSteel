import React, { useState, useMemo } from 'react';
import {
  selectOptimalSteelProfiles,
  type BeamModel,
  type SteelCandidateEvaluation,
  type SteelProfileType,
  type SteelSelectionCriteria,
  type SteelSelectionResult,
  SteelDesignValidationError,
  StructuralAnalysisError,
} from '@optisteel/core';

interface SteelProfileSelectorProps {
  beamModel: BeamModel;
  isModelValid: boolean;
}

type TableFilterMode = 'all' | 'viable' | 'disqualified';

export const SteelProfileSelector: React.FC<SteelProfileSelectorProps> = ({
  beamModel,
  isModelValid,
}) => {
  // --- Form & Selection Criteria State ---
  const [profileTypeFilter, setProfileTypeFilter] = useState<SteelProfileType | 'ALL'>('ALL');
  const [allowableBendingStress, setAllowableBendingStress] = useState<string>('150'); // 150 MPa typical ASD
  const [deflectionDenominator, setDeflectionDenominator] = useState<string>('360'); // L/360
  const [allowableShearStress, setAllowableShearStress] = useState<string>(''); // Optional
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(true);
  const [elasticModulus, setElasticModulus] = useState<string>(
    String(beamModel.material?.E ?? 200)
  );

  // --- UI View State ---
  const [tableFilter, setTableFilter] = useState<TableFilterMode>('viable');
  const [selectedProfileDesignation, setSelectedProfileDesignation] = useState<string | null>(null);

  // Build validated criteria object
  const criteria = useMemo<SteelSelectionCriteria | null>(() => {
    const sigmaAdm = parseFloat(allowableBendingStress);
    const defDenom = parseFloat(deflectionDenominator);
    const eMod = parseFloat(elasticModulus);
    const tauAdm = allowableShearStress.trim() !== '' ? parseFloat(allowableShearStress) : undefined;

    if (Number.isNaN(sigmaAdm) || sigmaAdm <= 0) return null;
    if (Number.isNaN(defDenom) || defDenom <= 0) return null;
    if (Number.isNaN(eMod) || eMod <= 0) return null;
    if (tauAdm !== undefined && (Number.isNaN(tauAdm) || tauAdm <= 0)) return null;

    return {
      profileTypeFilter,
      allowableBendingStressMPa: sigmaAdm,
      deflectionLimitDenominator: defDenom,
      elasticModulusGPa: eMod,
      ...(tauAdm !== undefined ? { allowableShearStressMPa: tauAdm } : {}),
      includeSelfWeight,
    };
  }, [
    profileTypeFilter,
    allowableBendingStress,
    deflectionDenominator,
    allowableShearStress,
    includeSelfWeight,
    elasticModulus,
  ]);

  // Execute core steel profile selector
  const { result, error }: { result?: SteelSelectionResult; error?: string } = useMemo(() => {
    if (!isModelValid) {
      return {};
    }
    if (!criteria) {
      return { error: 'Verifique los parámetros de diseño: deben ser valores numéricos positivos.' };
    }
    try {
      const selResult = selectOptimalSteelProfiles(beamModel, criteria);
      return { result: selResult };
    } catch (err) {
      if (err instanceof SteelDesignValidationError) {
        return { error: err.message };
      }
      if (err instanceof StructuralAnalysisError) {
        return { error: err.message };
      }
      return { error: (err as Error).message || 'Error inesperado durante la selección de perfiles.' };
    }
  }, [beamModel, criteria, isModelValid]);

  // Filter candidates for tabular display
  const displayedCandidates = useMemo<readonly SteelCandidateEvaluation[]>(() => {
    if (!result) return [];
    if (tableFilter === 'viable') return result.viableCandidates;
    if (tableFilter === 'disqualified') return result.disqualifiedCandidates;
    // 'all': pool ordered by mass with viable first
    return [...result.viableCandidates, ...result.disqualifiedCandidates];
  }, [result, tableFilter]);

  const selectedCandidate = useMemo<SteelCandidateEvaluation | undefined>(() => {
    if (!result || !selectedProfileDesignation) return undefined;
    return (
      result.viableCandidates.find((c) => c.profile.designation === selectedProfileDesignation) ??
      result.disqualifiedCandidates.find((c) => c.profile.designation === selectedProfileDesignation)
    );
  }, [result, selectedProfileDesignation]);

  return (
    <section className="glass-panel steel-selector-panel" aria-labelledby="steel-selector-heading">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 id="steel-selector-heading" className="panel-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 7h10M7 12h10M7 17h10" />
          </svg>
          Selector de Perfiles de Acero Estructural (Pytel & Singer Tabla B-2)
        </h2>
        <span className="diagram-badge">76 Secciones (W, S, C)</span>
      </div>

      {/* Mandatory Technical Engineering Warnings Banner */}
      <div className="scope-banner" role="alert">
        <div className="scope-banner-header">
          <div className="scope-banner-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Alcance Técnico: Prediseño Elástico Preliminar</span>
          </div>
          <span className="scope-badge-partial">Evaluación Parcial: LTB No Evaluado</span>
        </div>
        <ul className="scope-banner-list">
          <li>
            <strong>Sin certificación normativa integral:</strong> Este motor realiza un prediseño elástico preliminar bajo tensiones admisibles y servicio de deflexión. No sustituye la revisión normativa exhaustiva según AISC 360-16 ni NSR-10 Título F.
          </li>
          <li>
            <strong>Pandeo Lateral-Torsional (LTB):</strong> Permanece sin evaluar debido a que el catálogo canónico no contiene dimensiones de alas ($b_f, t_f$), radios de giro menores ($r_y$) ni constantes torsionales ($J, C_w$). La flexión presupone arriostramiento lateral continuo ($L_b \le L_p$).
          </li>
          <li>
            <strong>Esfuerzo cortante:</strong> Se calcula como esfuerzo cortante medio en el alma ($\tau = |V| / [d \cdot t_w]$). Si no se suministra cortante admisible, permanece con estado informativo no evaluado formalmente.
          </li>
          <li>
            <strong>Responsabilidad profesional:</strong> Esta herramienta analítica no reemplaza la memoria de cálculo ni el criterio de un ingeniero civil o estructural calificado.
          </li>
        </ul>
      </div>

      {/* Criteria Configuration Form */}
      <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--bg-input)' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
          Parámetros y Criterios de Selección
        </h3>

        <div className="form-row form-row-3" style={{ marginBottom: '0.75rem' }}>
          {/* Family Filter */}
          <div className="form-group">
            <label htmlFor="profile-family-select" className="form-label">
              Familia de Perfiles
            </label>
            <select
              id="profile-family-select"
              className="form-control"
              value={profileTypeFilter}
              onChange={(e) => setProfileTypeFilter(e.target.value as SteelProfileType | 'ALL')}
            >
              <option value="ALL">Todas las Familias (76 perfiles)</option>
              <option value="W">Familia W — Patín Ancho (46 perfiles)</option>
              <option value="S">Familia S — Estándar Americano I (16 perfiles)</option>
              <option value="C">Familia C — Canales Estándar (14 perfiles)</option>
            </select>
          </div>

          {/* Allowable Bending Stress */}
          <div className="form-group">
            <label htmlFor="allowable-bending-stress-input" className="form-label">
              Tensión Admisible Flexión σ<sub>adm</sub> (MPa)
            </label>
            <input
              id="allowable-bending-stress-input"
              type="number"
              step="5"
              min="10"
              className="form-control"
              value={allowableBendingStress}
              onChange={(e) => setAllowableBendingStress(e.target.value)}
              placeholder="Ej. 150 (ASD A36)"
              required
            />
          </div>

          {/* Deflection Limit Denominator */}
          <div className="form-group">
            <label htmlFor="deflection-limit-denominator-input" className="form-label">
              Límite de Flecha L/n (Denominador n)
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                id="deflection-limit-denominator-input"
                type="number"
                step="20"
                min="50"
                className="form-control"
                value={deflectionDenominator}
                onChange={(e) => setDeflectionDenominator(e.target.value)}
                placeholder="Ej. 360"
                required
              />
              <select
                aria-label="Preajustes de límite de flecha"
                className="form-control"
                style={{ width: 'auto', flexShrink: 0 }}
                value={deflectionDenominator}
                onChange={(e) => setDeflectionDenominator(e.target.value)}
              >
                <option value="180">L/180</option>
                <option value="240">L/240</option>
                <option value="300">L/300</option>
                <option value="360">L/360</option>
                <option value="480">L/480</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-row form-row-3" style={{ marginBottom: '0.5rem' }}>
          {/* Optional Shear Stress */}
          <div className="form-group">
            <label htmlFor="allowable-shear-stress-input" className="form-label">
              Tensión Admisible Cortante τ<sub>adm</sub> (MPa, Opcional)
            </label>
            <input
              id="allowable-shear-stress-input"
              type="number"
              step="5"
              min="5"
              className="form-control"
              value={allowableShearStress}
              onChange={(e) => setAllowableShearStress(e.target.value)}
              placeholder="Opcional (Ej. 90)"
            />
          </div>

          {/* Modulus of Elasticity */}
          <div className="form-group">
            <label htmlFor="elastic-modulus-input" className="form-label">
              Módulo de Elasticidad E (GPa)
            </label>
            <input
              id="elastic-modulus-input"
              type="number"
              step="5"
              min="10"
              className="form-control"
              value={elasticModulus}
              onChange={(e) => setElasticModulus(e.target.value)}
              placeholder="200"
              required
            />
          </div>

          {/* Include Self-Weight Checkbox */}
          <div className="form-group" style={{ justifyContent: 'center' }}>
            <label className="form-label" style={{ visibility: 'hidden' }}>
              Peso Propio
            </label>
            <label
              htmlFor="include-self-weight-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: 'var(--text-main)',
                fontWeight: 600,
              }}
            >
              <input
                id="include-self-weight-checkbox"
                type="checkbox"
                checked={includeSelfWeight}
                onChange={(e) => setIncludeSelfWeight(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
              />
              <span>Incluir peso propio como carga distribuida</span>
            </label>
          </div>
        </div>
      </div>

      {/* Model Incomplete or Unstable Warning */}
      {!isModelValid && (
        <div className="alert alert-warning" role="alert">
          <div>
            <strong>Modelo Incompleto:</strong> Para ejecutar el motor de selección de perfiles, la viga debe estar completamente configurada con apoyos isostáticos estables y cargas válidas en el panel izquierdo.
          </div>
        </div>
      )}

      {/* Engine Error Alert */}
      {error && (
        <div className="alert alert-error" role="alert">
          <div>
            <strong>Error del Selector:</strong> {error}
          </div>
        </div>
      )}

      {/* Selection Engine Results */}
      {result && (
        <>
          {/* Summary Metric Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Perfiles Evaluados</span>
              <span className="metric-value" style={{ color: '#38bdf8' }}>
                {result.totalEvaluated}
              </span>
              <span className="metric-unit">
                {criteria?.profileTypeFilter === 'ALL' ? 'Catálogo completo' : `Familia ${criteria?.profileTypeFilter}`}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Viables Preliminares</span>
              <span
                className="metric-value"
                style={{ color: result.viableCandidates.length > 0 ? '#10b981' : '#f43f5e' }}
              >
                {result.viableCandidates.length}
              </span>
              <span className="metric-unit">
                {result.viableCandidates.length > 0
                  ? `${((result.viableCandidates.length / result.totalEvaluated) * 100).toFixed(0)}% del catálogo`
                  : 'Ninguno cumple'}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Descalificados</span>
              <span className="metric-value" style={{ color: '#f59e0b' }}>
                {result.disqualifiedCandidates.length}
              </span>
              <span className="metric-unit">Por flexión o flecha</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Perfil Preliminar Óptimo</span>
              <span
                className="metric-value"
                style={{
                  fontSize: result.optimalProfile ? '1.15rem' : '0.95rem',
                  color: result.optimalProfile ? '#38bdf8' : '#94a3b8',
                }}
              >
                {result.optimalProfile ? result.optimalProfile.profile.designation : 'Sin candidato'}
              </span>
              <span className="metric-unit">
                {result.optimalProfile
                  ? `${result.optimalProfile.profile.massKgPerM.toFixed(1)} kg/m (Más liviano)`
                  : 'Modifique criterios'}
              </span>
            </div>
          </div>

          {/* Optimal Profile Spotlight Card */}
          {result.optimalProfile ? (
            <div className="optimal-card" aria-labelledby="optimal-profile-header">
              <div className="optimal-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span className="optimal-badge">Recomendación Preliminar Más Liviana</span>
                    <span id="optimal-profile-header" className="optimal-profile-name">
                      {result.optimalProfile.profile.designation}
                    </span>
                    <span className="item-badge">Tipo {result.optimalProfile.profile.type}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Satisface flexión elástica y límite de servicio L/{criteria?.deflectionLimitDenominator}.
                    {result.optimalProfile.selfWeightKNPerM > 0 &&
                      ` Incluye peso propio de ${result.optimalProfile.selfWeightKNPerM.toFixed(3)} kN/m.`}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {result.optimalProfile.profile.massKgPerM.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>kg/m</span>
                  </div>
                  <span className="scope-badge-partial">Evaluación Parcial</span>
                </div>
              </div>

              {/* Geometric Specs */}
              <div className="optimal-specs-grid">
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Peralte Total (d)</div>
                  <div className="optimal-spec-val">{result.optimalProfile.profile.depthMm} mm</div>
                </div>
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Espesor Alma (t_w)</div>
                  <div className="optimal-spec-val">{result.optimalProfile.profile.webThicknessMm} mm</div>
                </div>
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Módulo Elástico (S_x)</div>
                  <div className="optimal-spec-val">{result.optimalProfile.profile.sxThousandMm3} ×10³ mm³</div>
                </div>
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Inercia Eje Fuerte (I_x)</div>
                  <div className="optimal-spec-val">{result.optimalProfile.profile.ixMillionMm4} ×10⁶ mm⁴</div>
                </div>
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Uso a Flexión (DCR)</div>
                  <div className="optimal-spec-val" style={{ color: '#10b981' }}>
                    {(result.optimalProfile.bending.utilizationRatio * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="optimal-spec-item">
                  <div className="optimal-spec-label">Uso en Flecha (DCR)</div>
                  <div className="optimal-spec-val" style={{ color: '#10b981' }}>
                    {(result.optimalProfile.deflection.utilizationRatio * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Checks Breakdown Badges */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Comprobaciones:</span>
                <span className="badge-status badge-status-passed">
                  ✓ Flexión: {result.optimalProfile.bending.actualStressMPa.toFixed(1)} / {result.optimalProfile.bending.allowableStressMPa} MPa
                </span>
                <span className="badge-status badge-status-passed">
                  ✓ Flecha: {result.optimalProfile.deflection.maxDeflectionDemandMm.toFixed(2)} / {result.optimalProfile.deflection.allowableDeflectionMm.toFixed(2)} mm
                </span>
                <span className={`badge-status badge-status-${result.optimalProfile.shear.status}`}>
                  {result.optimalProfile.shear.status === 'passed' ? '✓' : 'ℹ'} Cortante: {result.optimalProfile.shear.actualShearStressMPa.toFixed(1)} MPa ({result.optimalProfile.shear.status === 'passed' ? 'Aprobado' : 'No Evaluado'})
                </span>
                <span className="badge-status badge-status-not_evaluated">
                  ℹ LTB: No Evaluado (Asume L_b ≤ L_p)
                </span>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning" role="alert" style={{ marginBottom: '1.25rem' }}>
              <div>
                <strong>Ningún candidato viable encontrado:</strong> Ninguno de los {result.totalEvaluated} perfiles evaluados de la familia seleccionada cumple simultáneamente los límites de flexión y deflexión bajo las cargas actuales.
                <ul style={{ margin: '0.5rem 0 0 1.2rem', fontSize: '0.8rem' }}>
                  <li>Pruebe seleccionando otra familia de perfiles o "Todas las Familias".</li>
                  <li>Aumente la tensión admisible si el grado de acero lo permite (ej. acero A572 Grado 50 con σ_adm = 210 MPa).</li>
                  <li>Relaje el límite de servicio de deflexión (ej. L/240 en lugar de L/360).</li>
                </ul>
              </div>
            </div>
          )}

          {/* Candidates Detailed Table */}
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-input)' }}>
            <div className="panel-header" style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Tabla Comparativa de Candidatos ({displayedCandidates.length})
                </h3>
                <div className="filter-pills" role="tablist" aria-label="Filtrar candidatos">
                  <button
                    type="button"
                    id="selector-table-filter-viable"
                    role="tab"
                    aria-selected={tableFilter === 'viable'}
                    className={`filter-pill-btn ${tableFilter === 'viable' ? 'active' : ''}`}
                    onClick={() => setTableFilter('viable')}
                  >
                    Viables ({result.viableCandidates.length})
                  </button>
                  <button
                    type="button"
                    id="selector-table-filter-all"
                    role="tab"
                    aria-selected={tableFilter === 'all'}
                    className={`filter-pill-btn ${tableFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTableFilter('all')}
                  >
                    Todos ({result.totalEvaluated})
                  </button>
                  <button
                    type="button"
                    id="selector-table-filter-disqualified"
                    role="tab"
                    aria-selected={tableFilter === 'disqualified'}
                    className={`filter-pill-btn ${tableFilter === 'disqualified' ? 'active' : ''}`}
                    onClick={() => setTableFilter('disqualified')}
                  >
                    Descalificados ({result.disqualifiedCandidates.length})
                  </button>
                </div>
              </div>
            </div>

            {displayedCandidates.length > 0 ? (
              <div className="table-wrapper">
                <table className="eng-table" aria-label="Resultados de selección de perfiles">
                  <thead>
                    <tr>
                      <th>Perfil</th>
                      <th>Tipo</th>
                      <th>Masa (kg/m)</th>
                      <th>d (mm)</th>
                      <th>t_w (mm)</th>
                      <th>S_x (10³ mm³)</th>
                      <th>I_x (10⁶ mm⁴)</th>
                      <th>Flexión (σ / σ_adm)</th>
                      <th>Flecha (δ / δ_adm)</th>
                      <th>Cortante medio</th>
                      <th>LTB</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCandidates.map((candidate) => {
                      const isOptimal = result.optimalProfile?.profile.designation === candidate.profile.designation;
                      const isSelected = selectedProfileDesignation === candidate.profile.designation;

                      return (
                        <tr
                          key={candidate.profile.designation}
                          style={{
                            backgroundColor: isOptimal
                              ? 'rgba(56, 189, 248, 0.08)'
                              : isSelected
                              ? 'rgba(255, 255, 255, 0.04)'
                              : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() =>
                            setSelectedProfileDesignation(
                              isSelected ? null : candidate.profile.designation
                            )
                          }
                          title="Haga clic para ver detalles y solicitaciones internas actuantes"
                        >
                          <td>
                            <strong>{candidate.profile.designation}</strong>
                            {isOptimal && (
                              <span
                                style={{
                                  marginLeft: '0.4rem',
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  backgroundColor: '#0284c7',
                                  color: '#fff',
                                }}
                              >
                                ÓPTIMO
                              </span>
                            )}
                          </td>
                          <td>{candidate.profile.type}</td>
                          <td>
                            <strong>{candidate.profile.massKgPerM.toFixed(1)}</strong>
                          </td>
                          <td>{candidate.profile.depthMm}</td>
                          <td>{candidate.profile.webThicknessMm}</td>
                          <td>{candidate.profile.sxThousandMm3}</td>
                          <td>{candidate.profile.ixMillionMm4}</td>

                          {/* Flexion status */}
                          <td>
                            <span
                              className={`badge-status badge-status-${candidate.bending.status}`}
                              title={`σ_act = ${candidate.bending.actualStressMPa} MPa, σ_adm = ${candidate.bending.allowableStressMPa} MPa`}
                            >
                              {(candidate.bending.utilizationRatio * 100).toFixed(0)}%
                            </span>
                          </td>

                          {/* Deflection status */}
                          <td>
                            <span
                              className={`badge-status badge-status-${candidate.deflection.status}`}
                              title={`δ_max = ${candidate.deflection.maxDeflectionDemandMm} mm, δ_adm = ${candidate.deflection.allowableDeflectionMm} mm`}
                            >
                              {(candidate.deflection.utilizationRatio * 100).toFixed(0)}%
                            </span>
                          </td>

                          {/* Shear status */}
                          <td>
                            <span
                              className={`badge-status badge-status-${candidate.shear.status}`}
                              title={candidate.shear.note}
                            >
                              {candidate.shear.actualShearStressMPa.toFixed(1)} MPa
                            </span>
                          </td>

                          {/* LTB status */}
                          <td>
                            <span
                              className="badge-status badge-status-not_evaluated"
                              title={candidate.ltb.reason}
                            >
                              No Evaluado
                            </span>
                          </td>

                          {/* Viability status */}
                          <td>
                            <span
                              className={`badge-status ${
                                candidate.isViable ? 'badge-status-passed' : 'badge-status-failed'
                              }`}
                            >
                              {candidate.isViable ? 'Viable' : 'No cumple'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No hay perfiles que coincidan con el filtro actual ({tableFilter}).
              </div>
            )}

            {/* Selected Profile Inspector Drawer/Card */}
            {selectedCandidate && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-hover)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    Detalle Técnico: {selectedCandidate.profile.designation} (Tipo {selectedCandidate.profile.type})
                  </h4>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedProfileDesignation(null)}
                  >
                    Cerrar Detalle
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Momento flector máximo M: </span>
                    <strong>{selectedCandidate.bending.maxMomentDemandKNm.toFixed(2)} kN·m</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Cortante máximo V: </span>
                    <strong>{selectedCandidate.shear.maxShearDemandKN.toFixed(2)} kN</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Flecha máxima δ: </span>
                    <strong>{selectedCandidate.deflection.maxDeflectionDemandMm.toFixed(2)} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Rigidez a flexión EI: </span>
                    <strong>{selectedCandidate.deflection.flexuralRigidityEIKNm2.toFixed(1)} kN·m²</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Peso propio añadido: </span>
                    <strong>{selectedCandidate.selfWeightKNPerM.toFixed(3)} kN/m</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Alcance de cálculo: </span>
                    <strong style={{ color: '#fbbf24' }}>Prediseño Elástico (allChecksEvaluated: false)</strong>
                  </div>
                </div>

                {selectedCandidate.failureReasons.length > 0 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                    <strong style={{ color: '#fb7185', fontSize: '0.78rem' }}>Motivos de Incumplimiento:</strong>
                    <ul style={{ margin: '0.25rem 0 0 1.2rem', fontSize: '0.75rem', color: '#fecdd3' }}>
                      {selectedCandidate.failureReasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
