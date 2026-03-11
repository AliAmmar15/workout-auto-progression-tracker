import { API } from './api.js';

export const AuthService = {
    login: async (email, password) => {
        const response = await API.post('/auth/login', { email, password });
        localStorage.setItem('access_token', response.access_token);
        return response;
    },

    register: async (username, email, password) => {
        return await API.post('/auth/register', { username, email, password });
    },

    logout: () => {
        localStorage.removeItem('access_token');
        window.location.hash = '/login';
    },

    getProfile: async () => {
        return await API.get('/users/me');
    }
};
