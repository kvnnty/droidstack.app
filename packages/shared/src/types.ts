/** Device status */
export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error';

/** Device (emulator or physical) */
export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  type: 'emulator' | 'physical';
  /** Android API level or iOS version */
  osVersion?: string;
  /** noVNC port, ADB port, etc. */
  ports?: {
    novnc?: number;
    adb?: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** User (from Supabase Auth) */
export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
