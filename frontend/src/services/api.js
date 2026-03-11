// Helper to get auth headers
function getHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

const BACKEND_URL = 'http://localhost:8000';

async function apiCall(endpoint, options = {}) {
    const url = `${BACKEND_URL}/api/v1${endpoint}`;

    const config = {
        ...options,
        headers: {
            ...getHeaders(),
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);

        // Handle 401 Unauthorized (Token Expired)
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.hash = '/login';
            throw new Error('Session expired. Please log in again.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'An error occurred');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export const API = {
    get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
    post: (endpoint, body) => apiCall(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => apiCall(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' })
};
