use serde::Serialize;
use tauri_plugin_shell::ShellExt;

use crate::config::openclaw_dir;

#[derive(Serialize)]
pub struct ContainerStatus {
    pub name: String,
    pub state: String,
    pub status: String,
}

#[derive(Serialize)]
pub struct OpenClawStatus {
    pub running: bool,
    pub containers: Vec<ContainerStatus>,
}

#[tauri::command]
pub async fn get_openclaw_status(app: tauri::AppHandle) -> Result<OpenClawStatus, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args([
            "compose",
            "-f",
            &format!("{}/docker-compose.yml", dir_str),
            "ps",
            "--format",
            "{{.Name}}\t{{.State}}\t{{.Status}}",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to check status: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut containers = Vec::new();
    let mut all_running = false;

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let state = parts[1].to_string();
            if parts[0] == "openclaw" && state == "running" {
                all_running = true;
            }
            containers.push(ContainerStatus {
                name: parts[0].to_string(),
                state,
                status: parts[2].to_string(),
            });
        }
    }

    Ok(OpenClawStatus {
        running: all_running,
        containers,
    })
}

#[tauri::command]
pub async fn get_openclaw_logs(app: tauri::AppHandle, lines: u32) -> Result<String, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args([
            "compose",
            "-f",
            &format!("{}/docker-compose.yml", dir_str),
            "logs",
            &format!("--tail={}", lines),
            "openclaw",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to get logs: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr))
}

#[tauri::command]
pub async fn start_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args([
            "compose",
            "-f",
            &format!("{}/docker-compose.yml", dir_str),
            "start",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to start: {}", e))?;

    if output.status.success() {
        Ok("Started".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn stop_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args([
            "compose",
            "-f",
            &format!("{}/docker-compose.yml", dir_str),
            "stop",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to stop: {}", e))?;

    if output.status.success() {
        Ok("Stopped".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn restart_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    let dir = openclaw_dir();
    let dir_str = dir.to_string_lossy().to_string();
    let shell = app.shell();

    let output = shell
        .command("docker")
        .args([
            "compose",
            "-f",
            &format!("{}/docker-compose.yml", dir_str),
            "restart",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to restart: {}", e))?;

    if output.status.success() {
        Ok("Restarted".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
