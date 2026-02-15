use serde::Serialize;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
pub struct DockerStatus {
    pub installed: bool,
    pub version: String,
    pub compose: bool,
    pub running: bool,
}

#[tauri::command]
pub async fn check_docker(app: tauri::AppHandle) -> Result<DockerStatus, String> {
    let shell = app.shell();

    // Check docker --version
    let docker_out = shell
        .command("docker")
        .args(["--version"])
        .output()
        .await;

    let (installed, version) = match docker_out {
        Ok(out) if out.status.success() => {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            (true, v)
        }
        _ => return Ok(DockerStatus {
            installed: false,
            version: String::new(),
            compose: false,
            running: false,
        }),
    };

    // Check docker compose version
    let compose_out = shell
        .command("docker")
        .args(["compose", "version"])
        .output()
        .await;
    let compose = compose_out.map(|o| o.status.success()).unwrap_or(false);

    // Check if Docker daemon is running
    let info_out = shell
        .command("docker")
        .args(["info"])
        .output()
        .await;
    let running = info_out.map(|o| o.status.success()).unwrap_or(false);

    Ok(DockerStatus {
        installed,
        version,
        compose,
        running,
    })
}

#[tauri::command]
pub fn get_docker_install_url() -> String {
    #[cfg(target_os = "macos")]
    return "https://docs.docker.com/desktop/setup/install/mac-install/".to_string();

    #[cfg(target_os = "windows")]
    return "https://docs.docker.com/desktop/setup/install/windows-install/".to_string();

    #[cfg(target_os = "linux")]
    return "https://docs.docker.com/engine/install/".to_string();
}

#[tauri::command]
pub fn is_linux() -> bool {
    cfg!(target_os = "linux")
}
