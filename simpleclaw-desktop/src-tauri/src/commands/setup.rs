use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri_plugin_shell::ShellExt;

use crate::config::openclaw_dir;

#[derive(Deserialize)]
pub struct SetupConfig {
    pub openrouter_key: String,
    pub bot_token: String,
    pub gateway_token: String,
    pub model_slug: String,
}

#[derive(Serialize)]
pub struct SetupResult {
    pub success: bool,
    pub message: String,
}

// ─── Embedded templates (from services.py) ──────────────────────────

const DOCKERFILE_CONTENT: &str = r#"FROM ghcr.io/openclaw/openclaw:latest

USER root

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    wget gnupg2 ca-certificates \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils libxss1 libgconf-2-4 \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends google-chrome-stable && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Redirect Brave Search API to local SearXNG adapter
RUN sed -i 's|https://api.search.brave.com/res/v1/web/search|http://searxng-adapter:3000/res/v1/web/search|g' /app/dist/*.js

USER node
"#;

// Docker Compose — no lightpanda for desktop (simpler stack)
const DOCKER_COMPOSE_CONTENT: &str = r#"services:
  openclaw:
    build: .
    image: openclaw-chrome:latest
    container_name: openclaw
    restart: unless-stopped
    shm_size: 2g
    env_file:
      - .env
    volumes:
      - ./openclaw-config.yaml:/app/config.yaml
      - ./data:/app/data
      - config:/home/node/.openclaw
    depends_on:
      - searxng
    ports:
      - "18789:18789"

  searxng:
    image: docker.io/searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://searxng:8080

  searxng-adapter:
    image: openclaw-chrome:latest
    container_name: searxng-adapter
    restart: unless-stopped
    user: node
    volumes:
      - ./searxng-adapter.js:/tmp/adapter.js:ro
    entrypoint: ["node", "/tmp/adapter.js"]
    depends_on:
      - searxng
      - openclaw

  valkey:
    image: docker.io/valkey/valkey:8-alpine
    container_name: searxng-redis
    restart: unless-stopped
    command: valkey-server --save 30 1 --loglevel warning

volumes:
  config:
    name: openclaw_desktop_config
"#;

const SEARXNG_SETTINGS_TEMPLATE: &str = r#"use_default_settings: true

general:
  instance_name: "OpenClaw Search"
  debug: false

search:
  safe_search: 0
  autocomplete: ""
  formats:
    - html
    - json

server:
  bind_address: "0.0.0.0"
  port: 8080
  secret_key: "{secret_key}"
  limiter: false
  image_proxy: false

redis:
  url: "redis://searxng-redis:6379/0"
"#;

const SEARXNG_ADAPTER_JS: &str = r#"const http = require('http');
const SEARXNG = 'http://searxng:8080/search';

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const q = url.searchParams.get('q') || '';
    const count = parseInt(url.searchParams.get('count') || '5', 10);
    const lang = url.searchParams.get('search_lang') || '';
    const searxParams = new URLSearchParams({ q, format: 'json' });
    if (lang) searxParams.set('language', lang);

    const resp = await fetch(`${SEARXNG}?${searxParams}`);
    const data = await resp.json();

    const results = (data.results || []).slice(0, count).map(r => ({
      title: r.title || '',
      url: r.url || '',
      description: r.content || '',
      age: r.publishedDate || undefined,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ web: { results } }));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ web: { results: [] } }));
  }
}).listen(3000, '0.0.0.0');
"#;

/// Model slug → OpenRouter model ID
fn model_mapping() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("gemini-3-flash", "google/gemini-3-flash-preview"),
        ("claude-sonnet-4", "anthropic/claude-sonnet-4"),
        ("gpt-4o", "openai/gpt-4o"),
    ])
}

fn generate_secret_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    hex::encode(bytes)
}

// We need hex encoding — add a simple inline impl to avoid a dependency
mod hex {
    pub fn encode(bytes: Vec<u8>) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

#[tauri::command]
pub async fn setup_openclaw(config: SetupConfig) -> Result<SetupResult, String> {
    let dir = openclaw_dir();

    // Create directories
    fs::create_dir_all(dir.join("searxng"))
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    fs::create_dir_all(dir.join("data"))
        .map_err(|e| format!("Failed to create data dir: {}", e))?;

    // Resolve model
    let mapping = model_mapping();
    let base_model = mapping
        .get(config.model_slug.as_str())
        .unwrap_or(&"google/gemini-3-flash-preview");
    let openrouter_model = format!("openrouter/{}", base_model);

    // Write Dockerfile
    fs::write(dir.join("Dockerfile"), DOCKERFILE_CONTENT)
        .map_err(|e| format!("Failed to write Dockerfile: {}", e))?;

    // Write docker-compose.yml
    fs::write(dir.join("docker-compose.yml"), DOCKER_COMPOSE_CONTENT)
        .map_err(|e| format!("Failed to write docker-compose.yml: {}", e))?;

    // Write .env
    let env_content = format!(
        "OPENROUTER_API_KEY={}\nTELEGRAM_BOT_TOKEN={}\nOPENCLAW_GATEWAY_TOKEN={}\nBRAVE_API_KEY=local-searxng\nLOG_LEVEL=info\n",
        config.openrouter_key, config.bot_token, config.gateway_token
    );
    fs::write(dir.join(".env"), env_content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    // Write openclaw-config.yaml
    let config_yaml = format!(
        r#"provider: openrouter
model: {model}
api_key: {key}

gateway:
  mode: local
  auth:
    type: token
    token: {gw_token}

channels:
  telegram:
    enabled: true
    botToken: {bot_token}
    dmPolicy: open
    allowFrom: ["*"]
    groupPolicy: allowlist
    streamMode: partial

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"#,
        model = openrouter_model,
        key = config.openrouter_key,
        gw_token = config.gateway_token,
        bot_token = config.bot_token,
    );
    fs::write(dir.join("openclaw-config.yaml"), config_yaml)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    // Write SearXNG settings
    let secret = generate_secret_key();
    let searxng_settings = SEARXNG_SETTINGS_TEMPLATE.replace("{secret_key}", &secret);
    fs::write(dir.join("searxng").join("settings.yml"), searxng_settings)
        .map_err(|e| format!("Failed to write SearXNG settings: {}", e))?;

    // Write SearXNG adapter
    fs::write(dir.join("searxng-adapter.js"), SEARXNG_ADAPTER_JS)
        .map_err(|e| format!("Failed to write adapter: {}", e))?;

    Ok(SetupResult {
        success: true,
        message: "Configuration generated".to_string(),
    })
}

#[tauri::command]
pub async fn deploy_openclaw(app: tauri::AppHandle) -> Result<SetupResult, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    // docker compose up -d --build
    let output = shell
        .command("docker")
        .args(["compose", "-f", &format!("{}/docker-compose.yml", dir_str), "up", "-d", "--build"])
        .output()
        .await
        .map_err(|e| format!("Failed to start Docker: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker compose failed: {}", stderr));
    }

    // Wait for container to start
    tokio::time::sleep(std::time::Duration::from_secs(10)).await;

    // Fix permissions
    let _ = shell
        .command("docker")
        .args(["exec", "-u", "root", "openclaw", "chown", "-R", "node:node", "/home/node/.openclaw"])
        .output()
        .await;

    // Configure browser profile
    let browser_commands = [
        vec!["exec", "openclaw", "node", "/app/openclaw.mjs", "browser", "create-profile", "--name", "headless", "--color", "#00FF00", "--driver", "openclaw"],
        vec!["exec", "openclaw", "node", "/app/openclaw.mjs", "config", "set", "browser.defaultProfile", "headless"],
        vec!["exec", "openclaw", "node", "/app/openclaw.mjs", "config", "set", "browser.noSandbox", "true"],
        vec!["exec", "openclaw", "node", "/app/openclaw.mjs", "config", "set", "browser.headless", "true"],
    ];

    for cmd in &browser_commands {
        let _ = shell.command("docker").args(cmd).output().await;
    }

    // Run doctor
    let _ = shell
        .command("docker")
        .args(["exec", "openclaw", "node", "/app/openclaw.mjs", "doctor", "--fix"])
        .output()
        .await;

    // Set gateway mode
    let _ = shell
        .command("docker")
        .args(["exec", "openclaw", "node", "/app/openclaw.mjs", "config", "set", "gateway.mode", "local"])
        .output()
        .await;

    Ok(SetupResult {
        success: true,
        message: "Docker containers started".to_string(),
    })
}

#[tauri::command]
pub async fn apply_optimizations(app: tauri::AppHandle, model_slug: String) -> Result<SetupResult, String> {
    let shell = app.shell();
    let cli_prefix = ["exec", "openclaw", "node", "/app/openclaw.mjs"];

    // Determine fallback models based on selected model
    let fallbacks: Vec<&str> = if model_slug.contains("claude") {
        vec!["openrouter/google/gemini-2.5-flash", "openrouter/anthropic/claude-haiku-4.5"]
    } else if model_slug.contains("gpt") {
        vec!["openrouter/google/gemini-2.5-flash", "openrouter/openai/gpt-4o-mini"]
    } else {
        vec!["openrouter/google/gemini-2.5-flash", "openrouter/anthropic/claude-haiku-4.5"]
    };

    // Token optimization commands
    let opt_commands: Vec<Vec<&str>> = vec![
        // Disable heartbeat
        vec!["config", "set", "agents.defaults.heartbeat", r#"{"every": "0m"}"#],
        // Sub-agent model
        vec!["config", "set", "agents.defaults.subagents", r#"{"model": "openrouter/google/gemini-3-flash-preview", "maxConcurrent": 2, "archiveAfterMinutes": 60}"#],
        // Image model
        vec!["config", "set", "agents.defaults.imageModel", r#"{"primary": "openrouter/google/gemini-2.5-flash", "fallbacks": ["openrouter/openai/gpt-4o-mini"]}"#],
        // Compaction
        vec!["config", "set", "agents.defaults.compaction", r#"{"mode": "default", "memoryFlush": {"enabled": true, "softThresholdTokens": 30000}}"#],
        // Context pruning
        vec!["config", "set", "agents.defaults.contextPruning", r#"{"mode": "cache-ttl", "ttl": "1h", "keepLastAssistants": 3}"#],
        // Concurrency
        vec!["config", "set", "agents.defaults.maxConcurrent", "2"],
        // Web search
        vec!["config", "set", "web.enabled", "true"],
        vec!["config", "set", "tools.web.search.provider", "brave"],
        vec!["config", "set", "tools.web.search.enabled", "true"],
        // Bootstrap limit
        vec!["config", "set", "agents.defaults.bootstrapMaxChars", "20000"],
        // Context tokens
        vec!["config", "set", "agents.defaults.contextTokens", "100000"],
        // Local RAG memory
        vec!["config", "set", "agents.defaults.memorySearch", r#"{"enabled": true, "provider": "local", "store": {"path": "/home/node/.openclaw/memory.db"}}"#],
    ];

    for cmd_args in &opt_commands {
        let mut args: Vec<&str> = cli_prefix.to_vec();
        args.extend(cmd_args);
        let _ = shell.command("docker").args(&args).output().await;
    }

    // Set fallback models
    let mut clear_args: Vec<&str> = cli_prefix.to_vec();
    clear_args.extend(["models", "fallbacks", "clear"]);
    let _ = shell.command("docker").args(&clear_args).output().await;

    for fb in &fallbacks {
        let mut fb_args: Vec<&str> = cli_prefix.to_vec();
        fb_args.extend(["models", "fallbacks", "add", fb]);
        let _ = shell.command("docker").args(&fb_args).output().await;
    }

    // Model aliases
    let aliases_json = r#"{"openrouter/anthropic/claude-opus-4.5":{"alias":"opus"},"openrouter/anthropic/claude-sonnet-4":{"alias":"sonnet"},"openrouter/anthropic/claude-haiku-4.5":{"alias":"haiku"},"openrouter/google/gemini-2.5-flash":{"alias":"flash"},"openrouter/deepseek/deepseek-reasoner":{"alias":"deepseek"},"openrouter/google/gemini-3-flash-preview":{"alias":"gemini3"}}"#;
    let mut alias_args: Vec<&str> = cli_prefix.to_vec();
    alias_args.extend(["config", "set", "agents.defaults.models", aliases_json]);
    let _ = shell.command("docker").args(&alias_args).output().await;

    // Start browser
    let mut browser_args: Vec<&str> = cli_prefix.to_vec();
    browser_args.extend(["browser", "start", "--browser-profile", "headless"]);
    let _ = shell.command("docker").args(&browser_args).output().await;

    Ok(SetupResult {
        success: true,
        message: "Optimizations applied".to_string(),
    })
}

#[tauri::command]
pub async fn teardown_openclaw(app: tauri::AppHandle) -> Result<SetupResult, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args(["compose", "-f", &format!("{}/docker-compose.yml", dir_str), "down", "-v"])
        .output()
        .await
        .map_err(|e| format!("Failed to teardown: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Teardown failed: {}", stderr));
    }

    Ok(SetupResult {
        success: true,
        message: "Containers stopped and removed".to_string(),
    })
}
