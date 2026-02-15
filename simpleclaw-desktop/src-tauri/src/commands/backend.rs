use serde::{Deserialize, Serialize};

use crate::config::BACKEND_URL;

#[derive(Serialize, Deserialize)]
pub struct RegisterResponse {
    pub openrouter_key: String,
    pub gateway_token: String,
    pub auth_token: String,
}

#[derive(Serialize, Deserialize)]
pub struct UsageResponse {
    pub used: f64,
    pub limit: f64,
    pub remaining: f64,
}

#[derive(Serialize, Deserialize)]
pub struct StatusResponse {
    pub subscription_active: bool,
    pub openrouter_key_active: bool,
    pub tokens_used: f64,
    pub token_limit: f64,
}

#[tauri::command]
pub async fn register_desktop(
    bot_token: String,
    model: String,
) -> Result<RegisterResponse, String> {
    let url = format!("{}/desktop/register/", BACKEND_URL);

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "bot_token": bot_token,
            "model": model,
            "platform": std::env::consts::OS,
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Registration failed ({}): {}", status, body));
    }

    resp.json::<RegisterResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub async fn check_usage(auth_token: String) -> Result<UsageResponse, String> {
    let url = format!("{}/desktop/usage/", BACKEND_URL);

    let resp = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Token {}", auth_token))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Usage check failed: {}", resp.status()));
    }

    resp.json::<UsageResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub async fn get_backend_status(auth_token: String) -> Result<StatusResponse, String> {
    let url = format!("{}/desktop/status/", BACKEND_URL);

    let resp = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Token {}", auth_token))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Status check failed: {}", resp.status()));
    }

    resp.json::<StatusResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[derive(Serialize, Deserialize)]
pub struct PaymentResponse {
    pub confirmation_url: String,
    pub payment_id: String,
}

#[tauri::command]
pub async fn create_payment(auth_token: String) -> Result<PaymentResponse, String> {
    let url = format!("{}/desktop/pay/", BACKEND_URL);

    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Token {}", auth_token))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Payment failed: {}", body));
    }

    resp.json::<PaymentResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

// ─── Profile ───────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct UserProfileData {
    pub selected_model: Option<String>,
    pub subscription_status: Option<String>,
    pub telegram_bot_username: Option<String>,
    pub tokens_used_usd: Option<f64>,
    pub token_limit_usd: Option<f64>,
    pub avatar_url: Option<String>,
    pub clawdmatrix_enabled: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct ProfileResponse {
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub profile: UserProfileData,
}

#[tauri::command]
pub async fn get_profile(auth_token: String) -> Result<ProfileResponse, String> {
    let url = format!("{}/auth/profile/", BACKEND_URL);

    let resp = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Token {}", auth_token))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Profile fetch failed: {}", resp.status()));
    }

    resp.json::<ProfileResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[derive(Deserialize)]
pub struct ProfileUpdatePayload {
    pub selected_model: Option<String>,
    pub clawdmatrix_enabled: Option<bool>,
}

#[tauri::command]
pub async fn update_profile(
    auth_token: String,
    payload: ProfileUpdatePayload,
) -> Result<ProfileResponse, String> {
    let url = format!("{}/auth/profile/", BACKEND_URL);

    let mut body = serde_json::Map::new();
    if let Some(model) = &payload.selected_model {
        body.insert("selected_model".to_string(), serde_json::Value::String(model.clone()));
    }
    if let Some(enabled) = payload.clawdmatrix_enabled {
        body.insert("clawdmatrix_enabled".to_string(), serde_json::Value::Bool(enabled));
    }

    let resp = reqwest::Client::new()
        .patch(&url)
        .header("Authorization", format!("Token {}", auth_token))
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let error_body = resp.text().await.unwrap_or_default();
        return Err(format!("Profile update failed: {}", error_body));
    }

    resp.json::<ProfileResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}
