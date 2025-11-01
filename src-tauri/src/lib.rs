use std::process::{Command, Child};
use std::sync::Mutex;
use std::path::PathBuf;

// Global state to track the sidecar process
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn start_sidecar() -> Result<(), String> {
    // Get the sidecar binary path relative to the app
    let sidecar_path = if cfg!(debug_assertions) {
        // Development: look in src-tauri/binaries
        PathBuf::from("src-tauri/binaries/main")
    } else {
        // Production: bundled next to the app executable
        let app_dir = std::env::current_exe()
            .map_err(|e| format!("Failed to get app dir: {}", e))?
            .parent()
            .ok_or("Failed to get parent directory")?
            .to_path_buf();
        app_dir.join("main")
    };

    if !sidecar_path.exists() {
        return Err(format!("Sidecar binary not found at {:?}", sidecar_path));
    }

    // Spawn the sidecar process
    let child = Command::new(&sidecar_path)
        .spawn()
        .map_err(|e| format!("Failed to start sidecar: {}", e))?;

    // Store the process handle
    let mut proc = SIDECAR_PROCESS.lock().unwrap();
    *proc = Some(child);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|_app| {
            // Start the Python sidecar when the app launches
            if let Err(e) = start_sidecar() {
                eprintln!("Warning: Failed to start sidecar: {}", e);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
