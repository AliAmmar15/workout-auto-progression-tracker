import { API } from './api.js';

export const ProgressionService = {
    getProgression: async (exerciseId) => {
        return await API.get(`/exercises/${exerciseId}/progression`);
    },

    getRecommendation: async (exerciseId) => {
        return await API.get(`/exercises/${exerciseId}/recommendation`);
    }
};
