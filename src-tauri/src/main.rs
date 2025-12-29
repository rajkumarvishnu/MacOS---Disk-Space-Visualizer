#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime, Manager};
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;

#[derive(Serialize, Deserialize, Clone)]
struct DiskItem {
    name: String,
    size: u64,
    children: Vec<DiskItem>,
}

lazy_static! {
    static ref LAST_EMIT: Arc<Mutex<Instant>> = Arc::new(Mutex::new(Instant::now()));
}

fn build_disk_item<R: Runtime>(
    app: &AppHandle<R>,
    path: &str,
    min_size: u64,
    max_size: Option<u64>,
) -> DiskItem {
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) => {
            println!("Failed to read metadata for {}: {}", path, e);
            return DiskItem {
                name: path.to_string(),
                size: 0,
                children: Vec::new(),
            };
        }
    };

    let mut size = if metadata.is_file() {
        metadata.len()
    } else {
        0
    };
    let mut children = Vec::new();

    if metadata.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let child_path = entry.path();
                let child_str = child_path.to_string_lossy().to_string();
                let child_item = build_disk_item(app, &child_str, min_size, max_size);

                // Apply size filters
                if child_item.size >= min_size
                    && max_size.map_or(true, |max| child_item.size <= max)
                {
                    size += child_item.size;
                    children.push(child_item);
                }
            }
            let disk_item = DiskItem {
                name: path.to_string(),
                size,
                children: children.clone(),
            };

            let now = Instant::now();
            let mut last_emit = LAST_EMIT.lock().unwrap();
            if now.duration_since(*last_emit) >= Duration::from_secs(5) {
                app.emit("disk", serde_json::to_string(&disk_item.children).unwrap())
                    .unwrap();
                *last_emit = now;
            }
            return disk_item;
        }
    }

    DiskItem {
        name: path.to_string(),
        size,
        children,
    }
}

#[tauri::command]
fn get_disk_utilization<R: Runtime>(
    path: String,
    min_size_mb: Option<f64>,
    max_size_mb: Option<f64>,
    app: AppHandle<R>,
) -> Result<DiskItem, String> {
    // Convert MB to bytes
    let min_size = min_size_mb.unwrap_or(5.0) * 1024.0 * 1024.0;
    let max_size = max_size_mb.map(|max| max * 1024.0 * 1024.0);

    Ok(build_disk_item(
        &app,
        &path,
        min_size as u64,
        max_size.map(|max| max as u64),
    ))
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    println!("Revealing in Finder: {}", path);
    Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let menu = MenuBuilder::new(app)
                .item(&MenuItem::with_id(app, "open", "Open", true, None::<&str>)?)
                .separator()
                .item(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_disk_utilization,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
