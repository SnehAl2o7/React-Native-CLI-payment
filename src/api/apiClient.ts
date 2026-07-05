import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ UPDATE THIS URL with your actual Vercel backend URL
const BASE_URL = 'https://your-backend.vercel.app';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token to all requests
apiClient.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading auth token:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor: handle 401 (unauthorized)
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear stored token
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  register: async (username: string, email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', {username, email, password});
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', {email, password});
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  getAll: async () => {
    const response = await apiClient.get('/api/payment');
    return response.data;
  },

  create: async (data: Record<string, string>) => {
    const response = await apiClient.post('/api/payment', data);
    return response.data;
  },

  update: async (id: string, data: Record<string, string>) => {
    const response = await apiClient.put(`/api/payment/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/api/payment/${id}`);
    return response.data;
  },
};

export default apiClient;
