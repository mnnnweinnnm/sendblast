import axios from 'axios';

const API_BASE = import.meta.env.PROD ? '' : '';

const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
export const setAuth = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
};
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
