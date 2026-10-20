mod fs_server;

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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
