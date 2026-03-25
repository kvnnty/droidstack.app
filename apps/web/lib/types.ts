export type OrgRole = 'owner' | 'admin' | 'member';

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
  role: OrgRole;
};

export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error' | 'starting' | 'running' | 'stopped';

export type DeviceHostPlatform = 'android' | 'ios';

export interface Device {
  id: string;
  userId: string;
  organizationId?: string;
  groupId?: string;
  name: string;
  deviceName?: string;
  deviceSerial?: string;
  status: DeviceStatus;
  type: 'emulator' | 'physical';
  osVersion?: string;
  hostPlatform?: DeviceHostPlatform;
  androidVersion?: string;
  cpu?: number;
  ram?: number;
  storage?: number;
  metadata?: Record<string, unknown>;
  batteryLevel?: number;
  lastSeenAt?: string;
  containerId?: string;
  adbPort?: number;
  novncPort?: number;
  ports?: { novnc?: number; adb?: number };
  createdAt: string;
  updatedAt: string;
}

export interface DeviceGroup {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  deviceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type CommandType =
  | 'install_app'
  | 'uninstall_app'
  | 'screenshot'
  | 'screen_record'
  | 'reboot'
  | 'shell'
  | 'clear_data'
  | 'push_notification';

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

export type AlertType = 'low_battery' | 'offline' | 'error' | 'high_temp';

export interface DeviceAlert {
  id: string;
  deviceId: string;
  alertType: AlertType;
  message?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  resolvedAt?: string;
}
