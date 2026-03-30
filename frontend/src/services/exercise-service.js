import { API } from './api.js';

export const ExerciseService = {
    getAll: async (muscleGroup = null) => {
        const query = muscleGroup ? `?muscle_group=${muscleGroup}` : '';
        return await API.get(`/exercises${query}`);
    },

    getById: async (id) => {
        return await API.get(`/exercises/${id}`);
    }
};
