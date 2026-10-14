import React, { useState, useMemo } from 'react';
import {
  analyzeBeam,
  validateBeamModel,
  type BeamAnalysisResult,
  type ValidationResult,
} from '@optisteel/core';
import type { BeamFormState, ActiveTab } from './types/ui.js';
import { adaptFormToBeamModel, getPresetModels } from './adapters/beamAdapter.js';
import { Header } from './components/Header.js';
import { BeamConfigForm } from './components/BeamConfigForm.js';
import { BeamSchematic } from './components/BeamSchematic.js';
import { AnalysisResults } from './components/AnalysisResults.js';
import { PytelSingerLibrary } from './components/PytelSingerLibrary.js';
import { SignConventionsModal } from './components/SignConventionsModal.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyzer');
  const [conventionsOpen, setConventionsOpen] = useState<boolean>(false);

  // Initialize with Preset 1 (Simple supported with uniform load)
  const [formState, setFormState] = useState<BeamFormState>(() => {
    const presets = getPresetModels();
    return presets[0]!.state;
  });

  // Adapt form to BeamModel
  const beamModel = useMemo(() => adaptFormToBeamModel(formState), [formState]);

  // Validate model using @optisteel/core
  const validation: ValidationResult = useMemo(() => {
    try {
      return validateBeamModel(beamModel);
    } catch (err) {
      return {
        isValid: false,
        errors: [(err as Error).message || 'Error de validación inesperado'],
        classification: 'invalid',
      };
    }
  }, [beamModel]);

  // Execute structural analysis using @optisteel/core
  const analysisResult: { result?: BeamAnalysisResult; error?: string } = useMemo(() => {
    if (!validation.isValid) {
      return {};
    }
    try {
      const res = analyzeBeam(beamModel);
      return { result: res };
    } catch (err) {
      return { error: (err as Error).message || 'Error durante el análisis estructural' };
    }
  }, [beamModel, validation]);

  const handleReset = () => {
    setFormState({
      length: 6.0,
      materialName: 'Acero A36',
      E: 200.0,
      sectionName: 'W10x30',
      Iz: 7076.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0, label: 'Apoyo A' },
        { id: 'S2', type: 'roller', x: 6.0, label: 'Apoyo B' },
      ],
      loads: [],
    });
  };

  const handleLoadPytelCase = (newFormState: BeamFormState) => {
    setFormState(newFormState);
    setActiveTab('analyzer');
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenConventions={() => setConventionsOpen(true)}
      />

      <main className="main-layout">
        {activeTab === 'analyzer' && (
          <div className="workspace-grid">
            {/* Left: Input Configuration Form */}
            <BeamConfigForm
              form={formState}
              onChange={setFormState}
              onReset={handleReset}
            />

            {/* Right: Visualization & Results */}
            <div className="workspace-results">
              {/* Validation Warning / Error Alert */}
              {!validation.isValid && (
                <div className="alert alert-error">
                  <div>
                    <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                      Configuración Incompleta o No Isostática ({validation.classification.toUpperCase()})
                    </h4>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                      {validation.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Execution Error Alert */}
              {analysisResult.error && (
                <div className="alert alert-error">
                  <div>
                    <strong>Error del Motor Estructural:</strong> {analysisResult.error}
                  </div>
                </div>
              )}

              {/* Beam Schematic (always rendered with current configuration) */}
              <BeamSchematic
                model={beamModel}
                reactions={analysisResult.result?.reactions}
              />

              {/* Real Analytical Results */}
              {analysisResult.result && (
                <AnalysisResults analysis={analysisResult.result} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'pytel-singer' && (
          <PytelSingerLibrary onLoadCase={handleLoadPytelCase} />
        )}
      </main>

      <SignConventionsModal
        isOpen={conventionsOpen}
        onClose={() => setConventionsOpen(false)}
      />

      <footer className="app-footer">
        <div>
          <strong>OptiSteel 2.0</strong> — Plataforma Avanzada de Análisis Estructural. Motor @optisteel/core (TypeScript ESM).
        </div>
        <div style={{ marginTop: '0.25rem' }}>
          Basado en formulación analítica exacta de Euler-Bernoulli y Tabla 6-2 de Pytel & Singer (4.ª Edición).
        </div>
      </footer>
    </div>
  );
};
