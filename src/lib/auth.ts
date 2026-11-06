/**
 * Authentication Service for VibeForge
 *
 * Handles JWT token management and authentication with NeuroForge backend.
 */

import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";
import { NEUROFORGE_URL } from "$lib/core/api/endpoints";

// ============================================================================
// Types
// ============================================================================

export interface User {
  user_id: string;
  username: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ============================================================================
// Configuration
// ============================================================================

const NEUROFORGE_API_BASE =
  NEUROFORGE_URL;
const TOKEN_STORAGE_KEY = "vibeforge_jwt_token";
const USER_STORAGE_KEY = "vibeforge_user";

// ============================================================================
// Stores
// ============================================================================

// Token store
function createTokenStore() {
  const { subscribe, set } = writable<string | null>(
    browser ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
  );

  return {
    subscribe,
    set: (token: string | null) => {
      if (browser) {
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
      set(token);
    },
    clear: () => {
      if (browser) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      set(null);
    },
  };
}

// User store
function createUserStore() {
  const { subscribe, set } = writable<User | null>(
    browser
      ? JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null")
      : null
  );

  return {
    subscribe,
    set: (user: User | null) => {
      if (browser) {
        if (user) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }
      set(user);
    },
    clear: () => {
      if (browser) {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
      set(null);
    },
  };
}

export const token = createTokenStore();
export const currentUser = createUserStore();
export const isAuthenticated = derived(token, ($token) => !!$token);

// ============================================================================
// API Functions
// ============================================================================

/**
 * Login with username and password
 */
export async function login(username: string, password: string): Promise<User> {
  const response = await fetch(
    `${NEUROFORGE_API_BASE}/api/v1/auth/login/json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Invalid credentials");
  }

  const data: TokenResponse = await response.json();

  // Store token
  token.set(data.access_token);

  // Decode JWT to get user info (basic decoding, doesn't verify signature)
  const user = decodeToken(data.access_token);
  currentUser.set(user);

  return user;
}

/**
 * Logout - clear token and user data
 */
export function logout() {
  token.clear();
  currentUser.clear();
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): HeadersInit {
  let currentToken: string | null = null;
  token.subscribe((t) => (currentToken = t))();

  if (currentToken) {
    return {
      Authorization: `Bearer ${currentToken}`,
    };
  }

  // Fallback to x-user-id for development
  return {
    "x-user-id": "anonymous",
  };
}

/**
 * Decode JWT token to extract user info
 * Note: This does NOT verify the signature - verification happens on the backend
 */
function decodeToken(token: string): User {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    const payload = JSON.parse(jsonPayload);

    return {
      user_id: payload.user_id || payload.sub,
      username: payload.sub || payload.username,
      email: payload.email,
    };
  } catch (error) {
    console.error("Failed to decode token:", error);
    return {
      user_id: "unknown",
      username: "unknown",
    };
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    const payload = JSON.parse(jsonPayload);
    const exp = payload.exp * 1000; // Convert to milliseconds

    return Date.now() >= exp;
  } catch (error) {
    return true; // If we can't decode, assume expired
  }
}

/**
 * Initialize auth state on app load
 */
export function initAuth() {
  if (!browser) return;

  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (storedToken) {
    // Check if token is expired
    if (isTokenExpired(storedToken)) {
      console.log("Stored token expired, clearing auth");
      logout();
    } else {
      // Token is valid, restore user
      const user = decodeToken(storedToken);
      currentUser.set(user);
      token.set(storedToken);
    }
  }
}
