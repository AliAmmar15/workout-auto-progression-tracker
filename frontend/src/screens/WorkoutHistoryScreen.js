import { WorkoutService } from '../services/workout-service.js';

export async function renderWorkoutHistoryScreen() {
    const container = document.createElement('div');
    container.className = 'container';

    container.innerHTML = `
        <div style="margin-bottom: 2.5rem; border-bottom: 1px solid var(--surface-border); padding-bottom: 1.5rem;">
            <h2 style="font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em;"><i class="fas fa-history" style="color: var(--color-primary); margin-right: 0.5rem;"></i> Training Log</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">Comprehensive timeline of all recorded sessions.</p>
        </div>
        
        <div id="workouts-container" style="display: flex; flex-direction: column; gap: 0;">
            <div style="text-align: center; padding: 3rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--color-primary);"></i>
            </div>
        </div>
    `;

    const workoutsContainer = container.querySelector('#workouts-container');

    try {
        const workouts = await WorkoutService.getAll();

        if (workouts.length === 0) {
            workoutsContainer.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; background: var(--surface-light); border: 1px dashed var(--surface-border); border-radius: 12px;">
                    <i class="fas fa-book-open" style="font-size: 2rem; color: var(--surface-border); margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.125rem; font-weight: 500;">No Training History</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; margin-top: 0.5rem;">You haven't logged any workouts yet.</p>
                    <a href="#/log" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.5rem 1rem;">Start First Session</a>
                </div>
            `;
            return container;
        }

        const detailedWorkouts = await Promise.all(
            workouts.map(w => WorkoutService.getById(w.id))
        );

        workoutsContainer.innerHTML = detailedWorkouts.map((workout, index) => `
            <div style="display: flex; position: relative; padding-bottom: 2.5rem;">
                ${index !== detailedWorkouts.length - 1 ? '<div style="position: absolute; left: 15px; top: 30px; bottom: 0; width: 2px; background: var(--surface-border);"></div>' : ''}
                
                <div style="margin-right: 1.5rem; position: relative;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--surface-medium); border: 2px solid var(--surface-border); display: flex; align-items: center; justify-content: center; z-index: 2; position: relative;">
                        <i class="fas fa-check" style="color: var(--color-primary); font-size: 0.75rem;"></i>
                    </div>
                </div>

                <div style="flex: 1; background: var(--surface-light); border: 1px solid var(--surface-border); border-radius: 12px; transition: border-color var(--transition-fast);">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--surface-border);">
                        <div>
                            <div style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em;">
                                ${new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; font-family: monospace;">
                                ${workout.id.toString().padStart(5, '0')} • ${new Date(workout.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <div style="background: rgba(126, 34, 206, 0.1); color: #d8b4fe; border: 1px solid rgba(126, 34, 206, 0.2); font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 999px;">
                            ${workout.sets.length} Sets
                        </div>
                    </div>

                    ${workout.notes ? `
                        <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border); font-size: 0.875rem; color: var(--text-secondary); background: rgba(0,0,0,0.1);">
                            <i class="fas fa-comment-alt" style="margin-right: 0.5rem; opacity: 0.7;"></i> ${workout.notes}
                        </div>
                    ` : ''}

                    <div style="padding: 1rem 1.5rem;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
                            <thead>
                                <tr style="color: var(--text-muted); border-bottom: 1px solid var(--surface-border);">
                                    <th style="padding-bottom: 0.5rem; font-weight: 500;">Exercise</th>
                                    <th style="padding-bottom: 0.5rem; font-weight: 500; text-align: right;">Weight</th>
                                    <th style="padding-bottom: 0.5rem; font-weight: 500; text-align: right;">Reps</th>
                                    <th style="padding-bottom: 0.5rem; font-weight: 500; text-align: right;">RPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${workout.sets.map(s => `
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.75rem 0; font-weight: 500; color: var(--text-primary);">${s.exercise?.name || 'Unknown'}</td>
                                        <td style="padding: 0.75rem 0; text-align: right; color: var(--text-secondary); font-family: monospace;">${s.weight} lbs</td>
                                        <td style="padding: 0.75rem 0; text-align: right; color: var(--text-secondary); font-family: monospace;">${s.reps}</td>
                                        <td style="padding: 0.75rem 0; text-align: right; color: ${s.rpe >= 8 ? '#f43f5e' : 'var(--text-muted)'}; font-family: monospace;">${s.rpe || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        workoutsContainer.innerHTML = `
            <div style="padding: 2rem; border: 1px solid rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.05); border-radius: 8px; color: #f43f5e; font-size: 0.875rem;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i> Error loading timeline: ${e.message}
            </div>
        `;
    }

    return container;
}
