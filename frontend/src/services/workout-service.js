import { API } from './api.js';

export const WorkoutService = {
    getAll: async (dateFrom = null, dateTo = null) => {
        let qs = [];
        if (dateFrom) qs.push(`date_from=${dateFrom}`);
        if (dateTo) qs.push(`date_to=${dateTo}`);

        const query = qs.length ? `?${qs.join('&')}` : '';
        return await API.get(`/workouts${query}`);
    },

    getById: async (id) => {
        return await API.get(`/workouts/${id}`);
    },

    logWorkoutAtomic: async (date, notes, sets) => {
        // Uses the Phase 3 endpoint
        return await API.post('/workouts/log', {
            date: date,
            notes: notes || null,
            sets: sets
        });
    },

    delete: async (id) => {
        return await API.delete(`/workouts/${id}`);
    }
};
