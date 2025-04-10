import { API_URL } from '../config';

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    try {
      const response = await fetch(`${API_URL}/api/users/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernameOrEmail: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Login failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  async signup(userData: SignupData) {
    try {
      const response = await fetch(`${API_URL}/api/users/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Signup failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },
}; 