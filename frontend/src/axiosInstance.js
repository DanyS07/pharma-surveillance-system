import axios from 'axios';

// withCredentials: true is required so the browser sends the HttpOnly JWT cookie
// on every request. The cookie is set by the backend on login and is never
// accessible to JavaScript — the browser handles it automatically.
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    withCredentials: true,
});

axiosInstance.interceptors.request.use(config => {
    const stored = localStorage.getItem('pharma_user');
    if (!stored) return config;

    try {
        const user = JSON.parse(stored);
        if (user.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
    } catch (_) {}

    return config;
});

export default axiosInstance;
