use serde::{Deserialize, Serialize};

use crate::config::TELEGRAM_API;

#[derive(Serialize)]
pub struct BotInfo {
    pub valid: bool,
    pub bot_name: String,
    pub bot_username: String,
}

#[derive(Deserialize)]
struct TelegramResponse {
    ok: bool,
    result: Option<TelegramBot>,
}

#[derive(Deserialize)]
struct TelegramBot {
    first_name: Option<String>,
    username: Option<String>,
}

#[tauri::command]
pub async fn validate_bot_token(token: String) -> Result<BotInfo, String> {
    let url = format!("{}/bot{}/getMe", TELEGRAM_API, token);

    let resp = reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let data: TelegramResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    if data.ok {
        let bot = data.result.unwrap_or(TelegramBot {
            first_name: None,
            username: None,
        });
        Ok(BotInfo {
            valid: true,
            bot_name: bot.first_name.unwrap_or_default(),
            bot_username: bot.username.unwrap_or_default(),
        })
    } else {
        Ok(BotInfo {
            valid: false,
            bot_name: String::new(),
            bot_username: String::new(),
        })
    }
}
