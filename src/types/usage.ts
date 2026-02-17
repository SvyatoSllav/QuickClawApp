export interface UsageData {
  used: number;
  limit: number;
  remaining: number;
}

export function usageFromJson(json: Record<string, unknown>): UsageData {
  return {
    used: Number(json['used']),
    limit: Number(json['limit']),
    remaining: Number(json['remaining']),
  };
}
