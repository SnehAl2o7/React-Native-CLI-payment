import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';


const BASE_URL = Platform.select({
  android: 'https://multiple-payment-info-system.vercel.app/', 
  ios: 'https://multiple-payment-info-system.vercel.app/',
  default: 'https://multiple-payment-info-system.vercel.app/',
});

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

/**
 * Payment type case mapping utilities.
 *
 * The frontend uses lowercase types ('bank', 'upi', 'paypal', 'paytm', 'usdt')
 * while the server uses PascalCase ('Bank', 'UPI', 'PayPal', 'Paytm', 'USDT').
 */
const FRONTEND_TO_SERVER_TYPE: Record<string, string> = {
  bank: 'Bank',
  paytm: 'Paytm',
  upi: 'UPI',
  paypal: 'PayPal',
  usdt: 'USDT',
};

const SERVER_TO_FRONTEND_TYPE: Record<string, string> = {
  Bank: 'bank',
  Paytm: 'paytm',
  UPI: 'upi',
  PayPal: 'paypal',
  USDT: 'usdt',
};

/**
 * Convert a frontend lowercase paymentType to server PascalCase.
 */
export const toServerPaymentType = (type: string): string =>
  FRONTEND_TO_SERVER_TYPE[type] || type;

/**
 * Convert a server PascalCase paymentType to frontend lowercase.
 */
export const toFrontendPaymentType = (type: string): string =>
  SERVER_TO_FRONTEND_TYPE[type] || type.toLowerCase();

/**
 * Map USDT field names between frontend and server.
 * Frontend uses 'usdtWalletAddress', server uses 'usdtAddress'.
 */
export const mapFieldsToServer = (data: Record<string, string>): Record<string, string> => {
  const mapped = {...data};

  // Map paymentType to server casing
  if (mapped.paymentType) {
    mapped.paymentType = toServerPaymentType(mapped.paymentType);
  }

  // Map usdtWalletAddress → usdtAddress for USDT payments
  if (mapped.usdtWalletAddress) {
    mapped.usdtAddress = mapped.usdtWalletAddress;
    delete mapped.usdtWalletAddress;
  }

  return mapped;
};

/**
 * Normalize a single payment object returned from the server
 * to match frontend expectations (lowercase types, usdtWalletAddress).
 */
export const normalizePayment = (payment: any): any => {
  if (!payment) {return payment;}
  const normalized = {...payment};

  // Normalize paymentType to lowercase
  if (normalized.paymentType) {
    normalized.paymentType = toFrontendPaymentType(normalized.paymentType);
  }

  // Map usdtAddress → usdtWalletAddress for frontend consumption
  if (normalized.usdtAddress && !normalized.usdtWalletAddress) {
    normalized.usdtWalletAddress = normalized.usdtAddress;
  }

  return normalized;
};

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

// Payment API — routes use /api/payments (plural, matching server)
export const paymentAPI = {
  getAll: async () => {
    const response = await apiClient.get('/api/payments');
    return response.data;
  },

  create: async (data: Record<string, string>) => {
    const response = await apiClient.post('/api/payments', mapFieldsToServer(data));
    return response.data;
  },

  update: async (id: string, data: Record<string, string>) => {
    const response = await apiClient.put(`/api/payments/${id}`, mapFieldsToServer(data));
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/api/payments/${id}`);
    return response.data;
  },

  setPrimary: async (id: string) => {
    const response = await apiClient.patch(`/api/payments/${id}/primary`);
    return response.data;
  },
};

export default apiClient;
