mod proxy;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_process::init());

    builder
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let proxy_state =
                proxy::ProxyState::new().expect("failed to initialize Rust proxy HTTP client");
            app.manage(proxy_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            proxy::commands::proxy_images,
            proxy::commands::proxy_images_streaming,
            proxy::commands::proxy_prompt_polish,
            proxy::commands::proxy_image_to_text,
            proxy::commands::proxy_image_to_text_streaming,
            proxy::commands::proxy_provider_models,
            proxy::commands::proxy_remote_image,
            proxy::commands::proxy_remote_image_with_type,
            proxy::commands::proxy_s3_head,
            proxy::commands::proxy_s3_get,
            proxy::commands::proxy_s3_put,
            proxy::commands::proxy_s3_delete,
            proxy::commands::get_default_image_storage_dir,
            proxy::commands::serve_local_image,
            proxy::commands::delete_local_images,
            proxy::commands::save_local_image,
            proxy::commands::save_image_to_downloads,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
