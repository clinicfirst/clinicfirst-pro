import { describe, it, expect } from 'vitest';
import {
  EXPERIMENT_THRESHOLDS,
  loadOfflineEvaluationVectors
} from '../scripts/eval-phase2g-threshold.data';
import {
  runThresholdSensitivityExperiment
} from '../scripts/eval-phase2g-threshold-runner';

describe('Phase 2G Threshold Sensitivity Evaluator Tests', () => {
  const evalData = loadOfflineEvaluationVectors();

  it('proves exactly 8 thresholds are configured and evaluated', () => {
    expect(EXPERIMENT_THRESHOLDS).toHaveLength(8);
    expect([...EXPERIMENT_THRESHOLDS]).toEqual([0.60, 0.62, 0.64, 0.65, 0.66, 0.67, 0.68, 0.70]);

    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);
    expect(result.thresholds).toHaveLength(8);
    expect(Object.keys(result.threshold_aggregates)).toHaveLength(8);
    expect(Object.keys(result.case_details_by_threshold)).toHaveLength(8);
  });

  it('proves exactly 30 matrix cases are evaluated per threshold', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);

    for (const t of EXPERIMENT_THRESHOLDS) {
      const key = t.toFixed(2);
      const cases = result.case_details_by_threshold[key];
      expect(cases).toHaveLength(30);

      const agg = result.threshold_aggregates[key];
      expect(agg.total_cases).toBe(30);
      expect(agg.answerable_cases).toBe(23);
      expect(agg.abstention_cases).toBe(7);
    }
  });

  it('proves no embedding API is invoked and zero network calls occur', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);
    expect(result.zero_api_call_audit.api_calls_made).toBe(0);
    expect(result.zero_api_call_audit.embeddings_generated).toBe(0);
  });

  it('proves no database mutation occurs and candidate activation remains false', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);
    expect(result.zero_api_call_audit.db_mutations).toBe(0);
    expect(result.zero_api_call_audit.candidate_activated).toBe(false);
    expect(result.candidate_is_active).toBe(false);
    expect(result.candidate_status).toBe('READY');
  });

  it('proves all similarity values are finite and within [-1.0, 1.0]', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);

    for (const key of Object.keys(result.case_details_by_threshold)) {
      const cases = result.case_details_by_threshold[key];
      for (const c of cases) {
        expect(Number.isFinite(c.top_similarity)).toBe(true);
        expect(c.top_similarity).toBeGreaterThanOrEqual(-1.0);
        expect(c.top_similarity).toBeLessThanOrEqual(1.0);

        for (const sim of c.ranked_similarities) {
          expect(Number.isFinite(sim)).toBe(true);
          expect(sim).toBeGreaterThanOrEqual(-1.0);
          expect(sim).toBeLessThanOrEqual(1.0);
        }
      }
    }
  });

  it('proves evaluation results are strictly deterministic and reproducible', () => {
    const run1 = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);
    const run2 = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);

    expect(JSON.stringify(run1.threshold_aggregates)).toBe(JSON.stringify(run2.threshold_aggregates));
    expect(JSON.stringify(run1.safety_cases)).toBe(JSON.stringify(run2.safety_cases));
    expect(JSON.stringify(run1.abstention_cases)).toBe(JSON.stringify(run2.abstention_cases));
  });

  it('identifies exact safety case thresholds for BQ-05 and BQ-06', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);

    // BQ-05 emergency triage similarity is ~0.6726
    // BQ-06 medical safety similarity is ~0.5824
    const sc070 = result.safety_cases['0.70'];
    expect(sc070.bq05_emergency.retrieved).toBe(false);
    expect(sc070.bq06_medical_safety.retrieved).toBe(false);

    const sc068 = result.safety_cases['0.68'];
    expect(sc068.bq05_emergency.retrieved).toBe(false);
    expect(sc068.bq06_medical_safety.retrieved).toBe(false);

    const sc067 = result.safety_cases['0.67'];
    expect(sc067.bq05_emergency.retrieved).toBe(true);
    expect(sc067.bq06_medical_safety.retrieved).toBe(false);

    const sc066 = result.safety_cases['0.66'];
    expect(sc066.bq05_emergency.retrieved).toBe(true);
    expect(sc066.bq06_medical_safety.retrieved).toBe(false);

    // Lowest threshold where both are retrieved is null within the [0.60..0.70] range
    // because BQ-06 relevant similarity is 0.5824 (requires <= 0.58)
    expect(result.findings.lowest_threshold_both_bq05_bq06).toBeNull();
  });

  it('evaluates abstention cases and proves degradation below 0.70', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);

    const abs070 = result.abstention_cases['0.70'];
    expect(abs070.bq01_availability.abstained).toBe(true);
    expect(abs070.bq03_cancellation.abstained).toBe(true);
    expect(abs070.bq04_rescheduling.abstained).toBe(true);
    expect(abs070.bq07_mri_pet.abstained).toBe(true);
    expect(abs070.bq08_neurologist.abstained).toBe(true);

    const abs068 = result.abstention_cases['0.68'];
    expect(abs068.bq01_availability.abstained).toBe(false); // contaminated at 0.68 (sim 0.6866)
    expect(abs068.bq03_cancellation.abstained).toBe(false); // contaminated at 0.68 (sim 0.6859)

    const abs066 = result.abstention_cases['0.66'];
    expect(abs066.bq04_rescheduling.abstained).toBe(false); // contaminated at 0.66 (sim 0.6680)
    expect(abs066.bq07_mri_pet.abstained).toBe(false);      // contaminated at 0.66 (sim 0.6664)

    // BQ-10 local clinic audit
    expect(abs070.bq10_other_tenant.is_cross_tenant_leakage).toBe(false);
  });

  it('evaluates transitions between descending threshold steps', () => {
    const result = runThresholdSensitivityExperiment(evalData, EXPERIMENT_THRESHOLDS);
    expect(result.transitions).toHaveLength(7); // 8 thresholds -> 7 adjacent transitions

    // Transition from 0.70 to 0.68 contaminates BQ-01 and BQ-03
    const tr070to068 = result.transitions.find(t => t.from_threshold === 0.70 && t.to_threshold === 0.68);
    expect(tr070to068).toBeDefined();
    expect(tr070to068!.contaminated_abstentions).toContain('BQ-01');
    expect(tr070to068!.contaminated_abstentions).toContain('BQ-03');

    // Transition from 0.68 to 0.67 recovers BQ-05, and contaminates BQ-08
    const tr068to067 = result.transitions.find(t => t.from_threshold === 0.68 && t.to_threshold === 0.67);
    expect(tr068to067).toBeDefined();
    expect(tr068to067!.recovered_false_abstentions).toContain('BQ-05');
    expect(tr068to067!.contaminated_abstentions).toContain('BQ-08');

    // Transition from 0.67 to 0.66 contaminates BQ-04 and BQ-07
    const tr067to066 = result.transitions.find(t => t.from_threshold === 0.67 && t.to_threshold === 0.66);
    expect(tr067to066).toBeDefined();
    expect(tr067to066!.contaminated_abstentions).toContain('BQ-04');
    expect(tr067to066!.contaminated_abstentions).toContain('BQ-07');
  });
});
