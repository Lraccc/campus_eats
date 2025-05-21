import axios from 'axios';
import { API_URL } from '../config';

const axiosConfig = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
axiosConfig.interceptors.request.use(
  (config) => {
    // You can modify the request config here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosConfig.interceptors.response.use(
  (response) => {
    // You can modify the response here
    return response;
  },
  (error) => {
    // Handle errors here
    return Promise.reject(error);
  }
);

export default axiosConfig; 