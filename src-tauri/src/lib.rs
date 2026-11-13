mod fs_server;

use tauri::{AppHandle, Emitter};

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_files(app: AppHandle, files: Vec<String>) {
    // Event'i frontend'e gönder
    if let Err(e) = app.emit("open-files", files) {
        eprintln!("Failed to emit open-files event: {}", e);
    }
}

#[tauri::command]
fn get_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            std::fs::canonicalize(&a)
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or(a)
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Web istemcisi icin HTTP dosya sunucusu (opsiyonel).
            // JSONEDITOR_FS_ROOT verilirse baslar; JSONEDITOR_FS_PORT (varsayilan 1422).
            if let Ok(root) = std::env::var("JSONEDITOR_FS_ROOT") {
                let port: u16 = std::env::var("JSONEDITOR_FS_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(1422);
                std::thread::spawn(move || {
                    fs_server::serve(std::path::PathBuf::from(root), port);
                });
            }
            
            // Linux'ta .desktop dosyasindan gelen --args'i handle et
            // Tauri v2'de cli plugin kullanilabilir
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            open_files,
            get_args
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
