// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod runtime_check;
mod code_analyzer;
mod project_generator;
mod pattern_generator;
mod runtime_detector;

use runtime_check::{check_all_runtimes, RuntimeCheckResult, RuntimeCache};
use code_analyzer::analyze_codebase;
use project_generator::generate_project;
use pattern_generator::{generate_pattern_project, ArchitecturePatternConfig, PatternGenerationResult};
use runtime_detector::{analyze_project, RuntimeAnalysisOptions, RecommendationResult};
use std::sync::Mutex;
use tauri::State;

// Global runtime cache with 5-minute TTL
struct AppState {
    cache: Mutex<RuntimeCache>,
}

#[tauri::command]
async fn check_runtimes(state: State<'_, AppState>) -> Result<RuntimeCheckResult, String> {
    // Try to get from cache first
    let cache = state.cache.lock().unwrap();
    
    // For now, always do a fresh check (can optimize later)
    drop(cache); // Release lock before async operation
    
    let result = check_all_runtimes().await;
    
    // Update cache
    let mut cache = state.cache.lock().unwrap();
    for runtime in &result.runtimes {
        cache.set(runtime.clone());
    }
    
    Ok(result)
}

#[tauri::command]
async fn refresh_runtime_cache(state: State<'_, AppState>) -> Result<(), String> {
    let mut cache = state.cache.lock().unwrap();
    cache.clear();
    Ok(())
}

#[tauri::command]
fn get_install_instructions(runtime_id: String) -> Result<String, String> {
    let instructions = match runtime_id.as_str() {
        "javascript-typescript" => {
            "Install Node.js:\n\
            • Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs\n\
            • macOS: brew install node\n\
            • Windows: Download from https://nodejs.org/"
        }
        "python" => {
            "Install Python:\n\
            • Ubuntu/Debian: sudo apt install python3 python3-pip\n\
            • macOS: brew install python3\n\
            • Windows: Download from https://python.org/"
        }
        "go" => {
            "Install Go:\n\
            • Ubuntu/Debian: sudo snap install go --classic\n\
            • macOS: brew install go\n\
            • Windows: Download from https://golang.org/"
        }
        "rust" => {
            "Install Rust:\n\
            • All platforms: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        }
        "java" => {
            "Install Java:\n\
            • Ubuntu/Debian: sudo apt install default-jdk\n\
            • macOS: brew install openjdk\n\
            • Windows: Download from https://adoptium.net/"
        }
        "git" => {
            "Install Git:\n\
            • Ubuntu/Debian: sudo apt install git\n\
            • macOS: brew install git\n\
            • Windows: Download from https://git-scm.com/"
        }
        "docker" => {
            "Install Docker:\n\
            • Ubuntu: Follow https://docs.docker.com/engine/install/ubuntu/\n\
            • macOS: Download Docker Desktop from https://www.docker.com/products/docker-desktop\n\
            • Windows: Download Docker Desktop from https://www.docker.com/products/docker-desktop"
        }
        "pnpm" => {
            "Install pnpm:\n\
            • npm install -g pnpm\n\
            • Or: curl -fsSL https://get.pnpm.io/install.sh | sh -"
        }
        "dart" | "kotlin" | "swift" => {
            "This runtime requires a Dev-Container setup.\n\
            Click 'Generate Dev-Container' to create the configuration automatically."
        }
        _ => "No installation instructions available for this runtime."
    };
    
    Ok(instructions.to_string())
}

#[tauri::command]
async fn generate_pattern_project_command(
    config: ArchitecturePatternConfig,
    window: tauri::Window
) -> Result<PatternGenerationResult, String> {
    use pattern_generator::generate_pattern_project_with_progress;
    generate_pattern_project_with_progress(config, window).await
}

#[tauri::command]
async fn analyze_project_runtime(
    options: RuntimeAnalysisOptions
) -> Result<RecommendationResult, String> {
    analyze_project(options)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            cache: Mutex::new(RuntimeCache::new(300)), // 5-minute TTL
        })
        .invoke_handler(tauri::generate_handler![
            check_runtimes,
            refresh_runtime_cache,
            get_install_instructions,
            analyze_codebase,
            generate_project,
            generate_pattern_project_command,
            analyze_project_runtime,
            // Written out in full rather than imported. `#[tauri::command]`
            // also emits a hidden `__cmd__` macro beside the function, and
            // `generate_handler!` needs that macro, which a `use` of the
            // function alone does not bring into scope. The bridge lives in
            // the library target so it can be compiled and tested without
            // this binary; see src/lib.rs.
            vibeforge::neuronforge::neuronforge_lane_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
