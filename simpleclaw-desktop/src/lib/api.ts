import { invoke } from "@tauri-apps/api/core";

// ─── Docker ─────────────────────────────────────────────

export interface DockerStatus {
  installed: boolean;
  version: string;
  compose: boolean;
  running: boolean;
}

export function checkDocker(): Promise<DockerStatus> {
  return invoke("check_docker");
}

export function getDockerInstallUrl(): Promise<string> {
  return invoke("get_docker_install_url");
}

export function isLinux(): Promise<boolean> {
  return invoke("is_linux");
}

// ─── Telegram ───────────────────────────────────────────

export interface BotInfo {
  valid: boolean;
  bot_name: string;
  bot_username: string;
}

export function validateBotToken(token: string): Promise<BotInfo> {
  return invoke("validate_bot_token", { token });
}

// ─── Backend API ────────────────────────────────────────

export interface RegisterResponse {
  openrouter_key: string;
  gateway_token: string;
  auth_token: string;
}

export interface UsageResponse {
  used: number;
  limit: number;
  remaining: number;
}

export interface StatusResponse {
  subscription_active: boolean;
  openrouter_key_active: boolean;
  tokens_used: number;
  token_limit: number;
}

export function registerDesktop(
  botToken: string,
  model: string
): Promise<RegisterResponse> {
  return invoke("register_desktop", { botToken, model });
}

export function checkUsage(authToken: string): Promise<UsageResponse> {
  return invoke("check_usage", { authToken });
}

export function getBackendStatus(authToken: string): Promise<StatusResponse> {
  return invoke("get_backend_status", { authToken });
}

export interface PaymentResponse {
  confirmation_url: string;
  payment_id: string;
}

export function createPayment(authToken: string): Promise<PaymentResponse> {
  return invoke("create_payment", { authToken });
}

// ─── Profile ───────────────────────────────────────────

export interface UserProfileData {
  selected_model: string | null;
  subscription_status: string | null;
  telegram_bot_username: string | null;
  tokens_used_usd: number | null;
  token_limit_usd: number | null;
  avatar_url: string | null;
  clawdmatrix_enabled: boolean | null;
}

export interface ProfileResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfileData;
}

export interface ProfileUpdatePayload {
  selected_model?: string;
  clawdmatrix_enabled?: boolean;
}

export function getProfile(authToken: string): Promise<ProfileResponse> {
  return invoke("get_profile", { authToken });
}

export function updateProfile(
  authToken: string,
  payload: ProfileUpdatePayload
): Promise<ProfileResponse> {
  return invoke("update_profile", { authToken, payload });
}

// ─── Setup & Deploy ─────────────────────────────────────

export interface SetupConfig {
  openrouter_key: string;
  bot_token: string;
  gateway_token: string;
  model_slug: string;
}

export interface SetupResult {
  success: boolean;
  message: string;
}

export function setupOpenclaw(config: SetupConfig): Promise<SetupResult> {
  return invoke("setup_openclaw", { config });
}

export function deployOpenclaw(): Promise<SetupResult> {
  return invoke("deploy_openclaw");
}

export function applyOptimizations(modelSlug: string): Promise<SetupResult> {
  return invoke("apply_optimizations", { modelSlug });
}

export function teardownOpenclaw(): Promise<SetupResult> {
  return invoke("teardown_openclaw");
}

// ─── Status & Control ───────────────────────────────────

export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
}

export interface OpenClawStatus {
  running: boolean;
  containers: ContainerStatus[];
}

export function getOpenclawStatus(): Promise<OpenClawStatus> {
  return invoke("get_openclaw_status");
}

export function getOpenclawLogs(lines: number): Promise<string> {
  return invoke("get_openclaw_logs", { lines });
}

export function startOpenclaw(): Promise<string> {
  return invoke("start_openclaw");
}

export function stopOpenclaw(): Promise<string> {
  return invoke("stop_openclaw");
}

export function restartOpenclaw(): Promise<string> {
  return invoke("restart_openclaw");
}
