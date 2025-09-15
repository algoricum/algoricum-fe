// src/helpers/storage-helper.ts
import type { Clinic, User } from "@/interfaces/services_type";
import { ACCESS_TOKEN_KEY, CLINIC_API_KEY, CLINIC_DATA_KEY, USER_DATA_KEY } from "../constants/localStorageKeys";

// Token management
export const setAccessToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
};

export const getAccessToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
};

// User data in localStorage
export const setLocalUserData = (userData: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }
};

export const getLocalUserData = (): User | null => {
  if (typeof window !== "undefined") {
    const userData = localStorage.getItem(USER_DATA_KEY);
    if (userData) {
      try {
        return JSON.parse(userData) as User;
      } catch (error) {
        console.error("Failed to parse user data from localStorage:", error);
      }
    }
  }
  return null;
};

// Clinic data in localStorage
export const setLocalClinicData = (clinicData: Clinic): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(CLINIC_DATA_KEY, JSON.stringify(clinicData));
  }
};

export const getLocalClinicData = (): Clinic | null => {
  if (typeof window !== "undefined") {
    const clinicData = localStorage.getItem(CLINIC_DATA_KEY);
    if (clinicData) {
      try {
        return JSON.parse(clinicData) as Clinic;
      } catch (error) {
        console.error("Failed to parse clinic data from localStorage:", error);
      }
    }
  }
  return null;
};

// Clear functions
export const clearClinicData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CLINIC_DATA_KEY);
  }
};

export const clearUserData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_DATA_KEY);
  }
};

export const clearApiKeyData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CLINIC_API_KEY);
  }
};

export const clearTokens = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const clearAll = (): void => {
  clearTokens();
  clearApiKeyData();
  clearUserData();
  clearClinicData();
};
