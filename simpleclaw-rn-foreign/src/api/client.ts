import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AppConfig } from '../config/appConfig';
import { getAuthToken } from '../services/secureStorage';

export class ApiException extends Error {
  statusCode: number | undefined;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = statusCode;
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedException';
  }
}

export class NetworkException extends ApiException {
  constructor(message = 'Network error') {
    super(message);
    this.name = 'NetworkException';
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: AppConfig.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response) {
      throw new NetworkException('Connection error');
    }

    const statusCode = error.response.status;

    if (statusCode === 401) {
      throw new UnauthorizedException();
    }

    const data = error.response.data as Record<string, unknown> | undefined;
    let message = 'An error occurred';
    if (data && typeof data === 'object') {
      message = (data['error'] as string) ?? (data['detail'] as string) ?? message;
    }

    throw new ApiException(message, statusCode);
  },
);

export default apiClient;
