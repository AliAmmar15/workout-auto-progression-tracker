import { ExerciseService } from '../services/exercise-service.js';
import { WorkoutService } from '../services/workout-service.js';

export async function renderWorkoutLogScreen() {
  const container = document.createElement('div');
  container.className = 'container';

  // Initial state
  let exercises = [];
  let sets = []; // Array of objects: { exercise_id, weight, reps, rpe }

  // Fetch exercises
  try {
    exercises = await ExerciseService.getAll();
  } catch (e) {
    if (window.showToast) window.showToast('Failed to load exercises', 'error');
  }

  // Build the UI
  container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
            <div>
                <h2><i class="fas fa-plus-circle" style="color: var(--color-primary);"></i> Log Workout</h2>
                <p style="color: var(--text-secondary);">Record your session data.</p>
            </div>
            <div>
                <input type="date" id="workout-date" class="form-input" style="width: auto;" required>
            </div>
        </div>

        <div class="glass-panel" style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">Add Set</h3>
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 1rem; align-items: end;">
                
                <div class="form-group" style="margin: 0;">
                    <label class="form-label">Exercise</label>
                    <select id="set-exercise" class="form-input" required>
                        <option value="" disabled selected>Select an exercise...</option>
                        ${exercises.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group" style="margin: 0;">
                    <label class="form-label">Weight (lbs)</label>
                    <input type="number" id="set-weight" class="form-input" min="0" step="2.5" placeholder="0">
                </div>

                <div class="form-group" style="margin: 0;">
                    <label class="form-label">Reps</label>
                    <input type="number" id="set-reps" class="form-input" min="1" placeholder="0">
                </div>

                <div class="form-group" style="margin: 0;">
                    <label class="form-label">RPE (1-10)</label>
                    <input type="number" id="set-rpe" class="form-input" min="1" max="10" placeholder="Optional">
                </div>

                <button id="btn-add-set" class="btn btn-secondary" style="height: 46px;">
                    <i class="fas fa-plus"></i> Add
                </button>
            </div>
        </div>

        <div class="glass-panel" id="sets-container" style="display: none; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">Recorded Sets</h3>
            <div id="sets-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <!-- Sets go here -->
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Workout Notes (Optional)</label>
            <textarea id="workout-notes" class="form-input" rows="3" placeholder="How did it feel?"></textarea>
        </div>

        <button id="btn-save-workout" class="btn btn-primary" style="width: 100%; margin-top: 1rem; display: none;">
            <i class="fas fa-save"></i> Complete Workout
        </button>
    `;

  // Set today as default date
  const dateInput = container.querySelector('#workout-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Logic for adding a set to the local list
  const btnAddSet = container.querySelector('#btn-add-set');
  const setsContainer = container.querySelector('#sets-container');
  const setsList = container.querySelector('#sets-list');
  const btnSaveWorkout = container.querySelector('#btn-save-workout');

  function renderSets() {
    if (sets.length === 0) {
      setsContainer.style.display = 'none';
      btnSaveWorkout.style.display = 'none';
      return;
    }

    setsContainer.style.display = 'block';
    btnSaveWorkout.style.display = 'flex';

    setsList.innerHTML = sets.map((s, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div>
                    <span style="display: inline-block; width: 24px; color: var(--text-muted);">#${idx + 1}</span>
                    <strong style="margin-left: 0.5rem;">${s.exercise_name}</strong>
                    <span style="margin-left: 1rem; color: var(--text-secondary);">
                        ${s.weight} lbs × ${s.reps} reps ${s.rpe ? `(RPE ${s.rpe})` : ''}
                    </span>
                </div>
                <button class="btn btn-remove-set" data-index="${idx}" style="background: transparent; color: var(--color-accent); padding: 0.5rem; border: none; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

    // Attach delete handlers
    container.querySelectorAll('.btn-remove-set').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        sets.splice(idx, 1);
        renderSets();
      });
    });
  }

  btnAddSet.addEventListener('click', () => {
    const exSelect = container.querySelector('#set-exercise');
    const weightInput = container.querySelector('#set-weight');
    const repsInput = container.querySelector('#set-reps');
    const rpeInput = container.querySelector('#set-rpe');

    if (!exSelect.value || !weightInput.value || !repsInput.value) {
      if (window.showToast) window.showToast('Please fill out exercise, weight, and reps.', 'error');
      return;
    }

    const parsedRpe = rpeInput.value ? parseInt(rpeInput.value) : null;

    if (parsedRpe !== null && (parsedRpe < 1 || parsedRpe > 10)) {
      if (window.showToast) window.showToast('RPE must be between 1 and 10.', 'error');
      return;
    }

    sets.push({
      exercise_id: parseInt(exSelect.value),
      exercise_name: exSelect.options[exSelect.selectedIndex].text,
      set_number: sets.length + 1, // backend requires 1-indexed set_number
      weight: parseFloat(weightInput.value),
      reps: parseInt(repsInput.value),
      rpe: parsedRpe
    });

    // Reset inputs smoothly
    weightInput.value = '';
    repsInput.value = '';
    rpeInput.value = '';
    exSelect.focus(); // keep focus for fast typing

    renderSets();
  });

  // Save Workout Logic
  btnSaveWorkout.addEventListener('click', async () => {
    const date = container.querySelector('#workout-date').value;
    const notes = container.querySelector('#workout-notes').value;

    btnSaveWorkout.disabled = true;
    btnSaveWorkout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      // Strip client-side only properties (exercise_name) before sending to API
      const payloadSets = sets.map(s => {
        const { exercise_name, ...rest } = s;
        return rest;
      });

      await WorkoutService.logWorkoutAtomic(date, notes, payloadSets);

      if (window.showToast) window.showToast('Workout saved successfully!', 'success');

      // Redirect to history
      window.location.hash = '/history';
    } catch (e) {
      if (window.showToast) window.showToast(e.message, 'error');
      btnSaveWorkout.disabled = false;
      btnSaveWorkout.innerHTML = '<i class="fas fa-save"></i> Complete Workout';
    }
  });

  return container;
}
