/** Device status */
export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error';

/** Device (emulator or physical) */
export interface Device {
  id: string;
  userId: string;
  organizationId?: string;
  groupId?: string;
  name: string;
  deviceSerial?: string;
  status: DeviceStatus;
  type: 'emulator' | 'physical';
  osVersion?: string;
  metadata?: Record<string, unknown>;
  batteryLevel?: number;
  lastSeenAt?: string;
  ports?: { novnc?: number; adb?: number };
  createdAt: string;
  updatedAt: string;
}

/** Device group */
export interface DeviceGroup {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  deviceCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Command types */
export type CommandType =
  | 'install_app'
  | 'uninstall_app'
  | 'screenshot'
  | 'screen_record'
  | 'reboot'
  | 'shell'
  | 'clear_data'
  | 'push_notification';

/** Device command */
export interface DeviceCommand {
  id: string;
  userId: string;
  commandType: CommandType;
  payload?: Record<string, unknown>;
  targetType: 'device' | 'group';
  targetIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  result?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

/** Alert types */
export type AlertType = 'low_battery' | 'offline' | 'error' | 'high_temp';

/** Device alert */
export interface DeviceAlert {
  id: string;
  deviceId: string;
  alertType: AlertType;
  message?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  resolvedAt?: string;
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
