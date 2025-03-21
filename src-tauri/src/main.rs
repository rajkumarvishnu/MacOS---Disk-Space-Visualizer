#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[derive(Serialize, Deserialize, Clone)]
struct DiskItem {
    name: String,
    size: u64,
    children: Vec<DiskItem>,
}

lazy_static! {
    static ref LAST_EMIT: Arc<Mutex<Instant>> = Arc::new(Mutex::new(Instant::now()));
}

fn build_disk_item<R: Runtime>(app: &AppHandle<R>, path: &str) -> DiskItem {
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
                let child_item = build_disk_item(app, &child_str);
                if child_item.size >= 5 * 1024 * 1024 {
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
fn get_disk_utilization<R: Runtime>(path: String, app: AppHandle<R>) -> Result<DiskItem, String> {
    build_disk_item(&app, &path).map_err(|e| format!("Failed to get disk utilization: {}", e))
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
        .invoke_handler(tauri::generate_handler![
            get_disk_utilization,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::generate_context;

    #[test]
    fn test_get_disk_utilization() {
        let app = tauri::AppBuilder::new().build(generate_context!()).unwrap();
        let result = get_disk_utilization("/path/to/test".to_string(), app.handle());
        assert!(result.is_ok());
    }

    #[test]
    fn test_reveal_in_finder() {
        let result = reveal_in_finder("/path/to/test".to_string());
        assert!(result.is_ok());
    }
}
