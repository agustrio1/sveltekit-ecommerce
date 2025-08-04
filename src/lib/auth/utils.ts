import { goto } from '$app/navigation';
import { browser } from '$app/environment';

/**
 * Interface for user data - only what's in JWT token
 */
export interface User {
  id: number;
  role: string;
}

/**
 * Interface for authentication response
 */
interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!browser) return null;
  
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      return null;
    }

    const data: AuthResponse = await response.json();
    return data.success ? data.user || null : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated, redirect to login if not
 * @param redirectPath - Path to redirect back to after login
 * @returns User object if authenticated, null if redirected
 */
export async function requireAuth(redirectPath?: string): Promise<User | null> {
  if (!browser) return null;
  
  const user = await getCurrentUser();
  
  if (!user) {
    const loginUrl = redirectPath 
      ? `/login?redirect=${encodeURIComponent(redirectPath)}`
      : '/login';
    
    goto(loginUrl);
    return null;
  }
  
  return user;
}

/**
 * Check if user has specific role
 * @param user - User object
 * @param requiredRole - Required role
 * @returns true if user has required role
 */
export function hasRole(user: User | null, requiredRole: string): boolean {
  if (!user) return false;
  return user.role === requiredRole || user.role === 'admin';
}

/**
 * Require specific role, redirect if user doesn't have it
 * @param requiredRole - Required role
 * @param redirectPath - Path to redirect to if unauthorized
 * @returns User object if authorized, null if redirected
 */
export async function requireRole(
  requiredRole: string, 
  redirectPath = '/unauthorized'
): Promise<User | null> {
  const user = await requireAuth();
  
  if (!user) return null;
  
  if (!hasRole(user, requiredRole)) {
    goto(redirectPath);
    return null;
  }
  
  return user;
}

/**
 * Get CSRF token from cookie
 * @returns CSRF token string or empty string if not found
 */
export function getCSRFTokenFromCookie(): string {
  if (!browser) return '';
  
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie => 
    cookie.trim().startsWith('csrf_token=')
  );
  
  if (csrfCookie) {
    return csrfCookie.split('=')[1];
  }
  
  return '';
}

/**
 * Create authenticated fetch function with CSRF token
 * @returns Fetch function with authentication headers
 */
export function createAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}) => {
    const csrfToken = getCSRFTokenFromCookie();
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken })
    };

    const mergedOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    return fetch(url, mergedOptions);
  };
}

/**
 * Handle authenticated API response
 * @param response - Fetch response
 * @returns Response object or throws error
 */
export async function handleAuthenticatedResponse(response: Response): Promise<Response> {
  if (response.status === 401) {
    // Unauthorized - redirect to login
    const currentPath = window.location.pathname + window.location.search;
    goto(`/login?redirect=${encodeURIComponent(currentPath)}`);
    throw new Error('Authentication required');
  }
  
  if (response.status === 403) {
    // Forbidden - redirect to unauthorized page
    goto('/unauthorized');
    throw new Error('Access forbidden');
  }
  
  return response;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  if (!browser) return;
  
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFTokenFromCookie()
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always redirect to login, even if logout request fails
    goto('/login');
  }
}

/**
 * Login user
 * @param email - User email
 * @param password - User password
 * @returns Promise with login result
 */
export async function login(email: string, password: string): Promise<{
  success: boolean;
  message?: string;
  user?: User;
}> {
  if (!browser) {
    return { success: false, message: 'Not in browser environment' };
  }
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { success: true, user: data.user };
    } else {
      return { 
        success: false, 
        message: data.error || data.message || 'Login failed' 
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      message: 'Network error occurred' 
    };
  }
}

/**
 * Register new user
 * @param userData - User registration data
 * @returns Promise with registration result
 */
export async function register(userData: {
  name: string;
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  message?: string;
  user?: User;
}> {
  if (!browser) {
    return { success: false, message: 'Not in browser environment' };
  }
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(userData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { success: true, user: data.user };
    } else {
      return { 
        success: false, 
        message: data.error || data.message || 'Registration failed' 
      };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { 
      success: false, 
      message: 'Network error occurred' 
    };
  }
}

/**
 * Check if user is authenticated without redirecting
 * @returns Promise<boolean>
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user role
 * @returns Promise<string | null>
 */
export async function getUserRole(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.role || null;
}

/**
 * Format user display name
 * @param user - User object
 * @returns Formatted display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Guest';
  return `User ${user.id}`;
}

/**
 * Validate email format
 * @param email - Email string
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Handle API errors consistently
 * @param error - Error object or string
 * @returns User-friendly error message
 */
export function handleApiError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  return 'Terjadi kesalahan yang tidak diketahui';
}