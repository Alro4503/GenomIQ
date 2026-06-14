import axios from 'axios';

// Portfolio demo: use relative URLs so Next.js API Routes handle everything
export const axiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);