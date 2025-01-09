// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
struct DiskItem {
    name: String,
    size: u64,
    children: Vec<DiskItem>,
}

fn build_disk_item(path: &str) -> DiskItem {
    println!("Scanning path: {}", path);

    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => {
            println!("Failed to read metadata for {}", path);
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
        println!("Reading directory: {}", path);
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let child_path = entry.path();
                let child_str = child_path.to_string_lossy().to_string();
                let child_item = build_disk_item(&child_str);
                if child_item.size >= 5 * 1024 * 1024 {
                    // Ignore folders less than 5MB
                    size += child_item.size;
                    children.push(child_item);
                }
            }
        }
    }

    DiskItem {
        name: path.to_string(),
        size,
        children,
    }
}

#[tauri::command]
fn get_disk_utilization(path: String) -> Result<DiskItem, String> {
    Ok(build_disk_item(&path))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_disk_utilization])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
