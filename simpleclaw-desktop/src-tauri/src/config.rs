use std::path::PathBuf;

/// Base directory for SimpleClaw Desktop config and Docker files.
/// ~/.simpleclaw-desktop/openclaw/
pub fn openclaw_dir() -> PathBuf {
    let base = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join(".simpleclaw-desktop").join("openclaw")
}

/// SimpleClaw backend API base URL
pub const BACKEND_URL: &str = "https://install-openclow.ru/api";

/// Telegram API base URL
pub const TELEGRAM_API: &str = "https://api.telegram.org";
