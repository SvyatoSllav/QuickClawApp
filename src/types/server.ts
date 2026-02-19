export interface ServerStatus {
  assigned: boolean;
  ipAddress: string | null;
  status: string | null;
  openclawRunning: boolean;
  gatewayToken: string | null;
  lastHealthCheck: string | null;
}

export interface ServerPool {
  available: number;
  totalActive: number;
  total: number;
}

export function serverStatusFromJson(json: Record<string, unknown>): ServerStatus {
  return {
    assigned: json['assigned'] as boolean,
    ipAddress: (json['ip_address'] as string) ?? null,
    status: (json['status'] as string) ?? null,
    openclawRunning: json['openclaw_running'] as boolean,
    gatewayToken: (json['gateway_token'] as string) ?? null,
    lastHealthCheck: (json['last_health_check'] as string) ?? null,
  };
}

export function serverPoolFromJson(json: Record<string, unknown>): ServerPool {
  return {
    available: json['available'] as number,
    totalActive: json['total_active'] as number,
    total: json['total'] as number,
  };
}
