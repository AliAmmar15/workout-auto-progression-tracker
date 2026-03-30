import { ExerciseService } from '../services/exercise-service.js';
import { ProgressionService } from '../services/progression-service.js';

export async function renderProgressionDashboard() {
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
        <div style="margin-bottom: 2.5rem; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h2 style="font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; display: flex; align-items: center; gap: 0.75rem;">
                    <div style="background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Analytics</div>
                </h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">Algorithm-driven prescriptive insights.</p>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.25rem 0.75rem; border: 1px solid var(--surface-border); border-radius: 4px; background: var(--surface-light); font-family: monospace;">
                ENGINE_V2_ACTIVE
            </div>
        </div>
        
        <div id="dashboard-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--color-primary);"></i>
            </div>
        </div>
    `;

  const contentArea = container.querySelector('#dashboard-content');

  try {
    const exercises = await ExerciseService.getAll();

    if (exercises.length === 0) {
      contentArea.innerHTML = `
                <div style="grid-column: 1/-1; padding: 4rem; text-align: center; border: 1px dashed var(--surface-border); border-radius: 12px; background: var(--surface-light);">
                    <div style="width: 48px; height: 48px; margin: 0 auto 1.5rem auto; border-radius: 8px; background: var(--surface-medium); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-database" style="color: var(--text-muted); font-size: 1.25rem;"></i>
                    </div>
                    <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 0.5rem;">Insufficient Data</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Log structural data to generate intelligence models.</p>
                </div>
            `;
      return container;
    }

    const insights = await Promise.all(exercises.map(async (ex) => {
      try {
        const progression = await ProgressionService.getProgression(ex.id);
        let recommendation = null;
        if (progression.recent_sets && progression.recent_sets.length > 0) {
          recommendation = await ProgressionService.getRecommendation(ex.id);
        }
        return { exercise: ex, progression, recommendation };
      } catch (e) {
        return null;
      }
    }));

    const validInsights = insights.filter(i => i !== null && i.recommendation !== null);

    if (validInsights.length === 0) {
      contentArea.innerHTML = `
                <div style="grid-column: 1/-1; padding: 4rem; text-align: center; border: 1px dashed var(--surface-border); border-radius: 12px; background: var(--surface-light);">
                    <div style="width: 48px; height: 48px; margin: 0 auto 1.5rem auto; border-radius: 8px; background: var(--surface-medium); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-chart-area" style="color: var(--text-muted); font-size: 1.25rem;"></i>
                    </div>
                    <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 0.5rem;">Awaiting Validation</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">The algorithm requires at least 3 discrete datasets to compute variance.</p>
                </div>
            `;
      return container;
    }

    contentArea.innerHTML = validInsights.map(item => {
      const { progression, recommendation } = item;
      const isPlateau = progression.plateau_detected;
      const isDeload = recommendation.is_deload;
      const isPr = progression.is_pr;

      const borderColor = isDeload ? 'rgba(234, 179, 8, 0.4)' : // Yellow for deload
        isPlateau ? 'rgba(244, 63, 94, 0.4)' :
          isPr ? 'rgba(56, 189, 248, 0.4)' : // Blue for PR
            progression.trend === 'improving' ? 'rgba(13, 148, 136, 0.4)' :
              'var(--surface-border)';

      const bgAccent = isDeload ? 'rgba(234, 179, 8, 0.05)' :
        isPlateau ? 'rgba(244, 63, 94, 0.05)' :
          isPr ? 'rgba(56, 189, 248, 0.05)' :
            progression.trend === 'improving' ? 'rgba(13, 148, 136, 0.05)' :
              'var(--surface-light)';

      const trendColor = isDeload ? '#eab308' :
        isPlateau ? '#f43f5e' :
          isPr ? '#38bdf8' :
            progression.trend === 'improving' ? '#14b8a6' :
              'var(--text-secondary)';

      return `
            <div style="background: ${bgAccent}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; height: 100%; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                    <div>
                        <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${progression.exercise_name}</h3>
                        <div style="font-size: 0.75rem; color: ${trendColor}; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.25rem;">
                            ${isDeload ? '<span style="display:inline-block; width:6px; height:6px; background:#eab308; border-radius:50%;"></span> Deload Required' :
          isPr ? '<span style="display:inline-block; width:6px; height:6px; background:#38bdf8; border-radius:50%;"></span> New PR Achieved!' :
            isPlateau ? '<span style="display:inline-block; width:6px; height:6px; background:#f43f5e; border-radius:50%;"></span> Plateau Alert' :
              progression.trend === 'improving' ? '<span style="display:inline-block; width:6px; height:6px; background:#14b8a6; border-radius:50%;"></span> Strong Progress' :
                '<span style="display:inline-block; width:6px; height:6px; background:var(--text-secondary); border-radius:50%;"></span> Maintaining'}
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; flex: 1;">
                    <div style="background: var(--surface-medium); border: 1px solid var(--surface-border); border-radius: 8px; padding: 1rem;">
                        <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Target Load</div>
                        <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); font-family: monospace; line-height: 1;">
                            ${recommendation.recommended_weight}<span style="font-size: 0.875rem; color: var(--text-muted); font-weight: 500; margin-left: 2px;">lbs</span>
                        </div>
                    </div>
                    <div style="background: var(--surface-medium); border: 1px solid var(--surface-border); border-radius: 8px; padding: 1rem;">
                        <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Volume</div>
                        <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); font-family: monospace; line-height: 1;">
                            ${recommendation.recommended_reps}<span style="font-size: 0.875rem; color: var(--text-muted); font-weight: 500; margin-left: 2px;">x</span>
                        </div>
                    </div>
                </div>
                
                <div style="border-top: 1px solid var(--surface-border); padding-top: 1rem; display: flex; align-items: flex-start; gap: 0.5rem;">
                    <i class="fas fa-terminal" style="color: var(--color-primary); font-size: 0.75rem; margin-top: 0.15rem;"></i>
                    <span style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.4;">${recommendation.reasoning}</span>
                </div>
            </div>
            `;
    }).join('');

  } catch (e) {
    contentArea.innerHTML = `
            <div style="grid-column: 1/-1; padding: 2rem; border: 1px solid rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.05); border-radius: 8px; color: #f43f5e; font-size: 0.875rem;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i> System Error: ${e.message}
            </div>
        `;
  }

  return container;
}
