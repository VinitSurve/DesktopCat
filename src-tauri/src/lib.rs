use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

mod ai;
mod keychain;
mod ocr;

// ─── Pet Settings ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetSettings {
    pub size: String, // "small", "medium", "large"
    pub speed: f64,   // movement speed multiplier
    pub opacity: f64, // 0.0 - 1.0
    pub always_on_top: bool,
    pub random_movement: bool,
    pub mouse_following: bool,
    pub keyboard_reactions: bool,
    pub idle_behavior: bool,
    pub launch_at_login: bool,
    pub start_pet_automatically: bool,
    pub sound_enabled: bool,
    pub sound_volume: f64,
    pub battery_saver: bool,
    pub ai_provider: String,
    pub local_model: String,
    pub gemini_model: String,
}

impl Default for PetSettings {
    fn default() -> Self {
        Self {
            size: "medium".to_string(),
            speed: 1.0,
            opacity: 1.0,
            always_on_top: true,
            random_movement: true,
            mouse_following: true,
            keyboard_reactions: true,
            idle_behavior: true,
            launch_at_login: false,
            start_pet_automatically: true,
            sound_enabled: false,
            sound_volume: 0.5,
            battery_saver: false,
            ai_provider: "AUTO".to_string(),
            local_model: "qwen2.5:0.5b".to_string(),
            gemini_model: "gemini-3.6-flash".to_string(),
        }
    }
}

// ─── Pet Position ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetPosition {
    pub x: f64,
    pub y: f64,
}

impl Default for PetPosition {
    fn default() -> Self {
        Self { x: 600.0, y: 400.0 }
    }
}

// ─── App State ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetState {
    pub settings: PetSettings,
    pub position: PetPosition,
    pub is_paused: bool,
}

impl Default for PetState {
    fn default() -> Self {
        Self {
            settings: PetSettings::default(),
            position: PetPosition::default(),
            is_paused: false,
        }
    }
}

pub struct AppState {
    pub pet_state: Mutex<PetState>,
}

// ─── File Helpers ────────────────────────────────────────────────────────────

fn config_dir() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.pixelpaw.app");
    fs::create_dir_all(&dir).ok();
    dir
}

fn settings_path() -> PathBuf {
    config_dir().join("settings.json")
}

fn position_path() -> PathBuf {
    config_dir().join("position.json")
}

fn load_settings() -> PetSettings {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_settings(settings: &PetSettings) {
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        fs::write(settings_path(), json).ok();
    }
}

fn load_position() -> PetPosition {
    fs::read_to_string(position_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_position(position: &PetPosition) {
    if let Ok(json) = serde_json::to_string_pretty(position) {
        fs::write(position_path(), json).ok();
    }
}

#[tauri::command]
fn save_data(key: String, data: String) {
    fs::write(config_dir().join(format!("{}.json", key)), data).ok();
}

#[tauri::command]
fn load_data(key: String) -> String {
    fs::read_to_string(config_dir().join(format!("{}.json", key)))
        .unwrap_or_else(|_| "".to_string())
}


// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> PetSettings {
    state.pet_state.lock().unwrap().settings.clone()
}

#[tauri::command]
fn update_settings(state: tauri::State<'_, AppState>, settings: PetSettings) {
    let mut pet_state = state.pet_state.lock().unwrap();
    pet_state.settings = settings.clone();
    save_settings(&settings);
}

#[tauri::command]
fn get_position(state: tauri::State<'_, AppState>) -> PetPosition {
    state.pet_state.lock().unwrap().position.clone()
}

#[tauri::command]
fn update_position(state: tauri::State<'_, AppState>, position: PetPosition) {
    let mut pet_state = state.pet_state.lock().unwrap();
    pet_state.position = position.clone();
    save_position(&position);
}

#[tauri::command]
fn get_pet_paused(state: tauri::State<'_, AppState>) -> bool {
    state.pet_state.lock().unwrap().is_paused
}

#[tauri::command]
fn set_pet_paused(state: tauri::State<'_, AppState>, paused: bool) {
    state.pet_state.lock().unwrap().is_paused = paused;
}

#[tauri::command]
fn get_monitor_info(window: tauri::Window) -> Option<serde_json::Value> {
    if let Some(monitor) = window.current_monitor().ok().flatten() {
        let pos = monitor.position();
        let size = monitor.size();
        let scale = monitor.scale_factor();
        Some(serde_json::json!({
            "x": pos.x,
            "y": pos.y,
            "width": size.width,
            "height": size.height,
            "scale_factor": scale,
        }))
    } else {
        None
    }
}

#[tauri::command]
fn get_all_monitors(window: tauri::Window) -> Vec<serde_json::Value> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            serde_json::json!({
                "x": pos.x,
                "y": pos.y,
                "width": size.width,
                "height": size.height,
                "scale_factor": m.scale_factor(),
                "name": m.name().cloned().unwrap_or_default(),
            })
        })
        .collect()
}

#[tauri::command]
fn show_reminder_window(app: tauri::AppHandle, url_params: String, x: f64, y: f64) {
    println!("[REMINDER WINDOW] creating at {}, {}", x, y);
    
    // First, close it if it already exists, to ensure fresh state/URL
    if let Some(win) = app.get_webview_window("reminder_window") {
        win.close().ok();
    }
    
    let url = format!("/?{}", url_params);
    
    match WebviewWindowBuilder::new(
        &app,
        "reminder_window",
        WebviewUrl::App(url.into()),
    )
    .title("PixelPaw Reminder")
    .inner_size(240.0, 120.0) // smaller bubble
    .position(x, y)
    .always_on_top(true)
    .decorations(false) // frameless
    .transparent(true)  // transparent background
    .resizable(false)
    .visible(true)
    .build()
    {
        Ok(win) => {
            println!("[REMINDER WINDOW] created");
            win.show().ok();
            println!("[REMINDER WINDOW] shown");
            win.set_focus().ok();
            println!("[REMINDER WINDOW] focused");
        }
        Err(e) => {
            println!("[REMINDER WINDOW ERROR] failed to create window: {:?}", e);
        }
    }
}

#[tauri::command]
fn test_reminder_window(app: tauri::AppHandle) {
    let url_params = "windowLabel=reminder_window&title=Drink%20Water&message=Water%20time%3F&icon=%F0%9F%92%A7&id=test-id&rtype=REMINDER".to_string();
    show_reminder_window(app, url_params, 100.0, 100.0);
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) {
    println!("SETTINGS: create requested");

    #[cfg(target_os = "macos")]
    {
        use objc::{msg_send, sel, sel_impl};
        unsafe {
            let ns_app: cocoa::base::id = msg_send![objc::class!(NSApplication), sharedApplication];
            let _: () = msg_send![ns_app, activateIgnoringOtherApps:cocoa::base::YES];
        }
    }

    if let Some(win) = app.get_webview_window("settings") {
        println!("SETTINGS: existing window found: true");
        println!("SETTINGS: window label: {}", win.label());
        println!("SETTINGS: visible: {:?}", win.is_visible());
        println!("SETTINGS: minimized: {:?}", win.is_minimized());
        println!("SETTINGS: focused: {:?}", win.is_focused());
        println!("SETTINGS: URL/path: /settings");

        win.show().ok();
        win.unminimize().ok();
        win.set_focus().ok();
    } else {
        println!("SETTINGS: existing window found: false");
        println!("SETTINGS: window label: settings");
        println!("SETTINGS: URL/path: /settings");

        match tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("/settings".into()),
        )
        .title("PixelPaw Settings")
        .inner_size(520.0, 640.0)
        .resizable(true)
        .decorations(true)
        .center()
        .build()
        {
            Ok(win) => {
                println!("SETTINGS: created successfully");
                println!("SETTINGS: visible: {:?}", win.is_visible());
                println!("SETTINGS: minimized: {:?}", win.is_minimized());
                println!("SETTINGS: focused: {:?}", win.is_focused());
            }
            Err(e) => {
                println!("SETTINGS: creation failed with error: {:?}", e);
            }
        }
    }
}

#[tauri::command]
fn open_ai_result_window(app: tauri::AppHandle) {
    let win = if let Some(win) = app.get_webview_window("ai_result") {
        win.show().ok();
        win.unminimize().ok();
        win.set_focus().ok();
        Some(win)
    } else {
        match tauri::WebviewWindowBuilder::new(
            &app,
            "ai_result",
            tauri::WebviewUrl::App("/".into()),
        )
        .title("PixelPaw AI")
        .inner_size(320.0, 400.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .center()
        .build()
        {
            Ok(w) => Some(w),
            Err(e) => {
                println!("AI_RESULT: creation failed with error: {:?}", e);
                None
            }
        }
    };

    if let Some(w) = win {
        #[cfg(target_os = "macos")]
        {
            use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
            use cocoa::base::id;
            use objc::{msg_send, sel, sel_impl};

            if let Ok(ns_window_val) = w.ns_window() {
                let ns_window = ns_window_val as id;
                unsafe {
                    // Set MoveToActiveSpace so it appears on the current Space (e.g., above Brave)
                    // instead of staying in the Antigravity Space.
                    let current_behavior: u64 = msg_send![ns_window, collectionBehavior];
                    let move_to_active_space = 1 << 1; // NSWindowCollectionBehaviorMoveToActiveSpace
                    let new_behavior = current_behavior | move_to_active_space;
                    let _: () = msg_send![ns_window, setCollectionBehavior:new_behavior];

                    let is_vis: bool = msg_send![ns_window, isVisible];
                    let lvl: i64 = msg_send![ns_window, level];
                    let parent: id = msg_send![ns_window, parentWindow];
                    let cb: u64 = msg_send![ns_window, collectionBehavior];
                    let parent_ptr = if parent.is_null() {
                        "null".to_string()
                    } else {
                        format!("{:?}", parent)
                    };

                    println!("[AI WINDOW]");
                    println!("label = {}", w.label());
                    println!("is_visible = {}", is_vis);
                    println!("always_on_top = {}", lvl > 0);
                    println!("parent = {}", parent_ptr);
                    println!("collection_behavior = {}", cb);
                }
            }
        }
    }
}

#[tauri::command]
fn open_ocr_selection_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("ocr_selection") {
        win.show().ok();
        win.set_focus().ok();
    } else {
        match tauri::WebviewWindowBuilder::new(
            &app,
            "ocr_selection",
            tauri::WebviewUrl::App("/".into()),
        )
        .title("PixelPaw Screen OCR")
        // Start hidden, we will maximize then show
        .visible(false)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .build()
        {
            Ok(win) => {
                #[cfg(target_os = "macos")]
                {
                    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
                    use cocoa::base::id;
                    use objc::{msg_send, sel, sel_impl};

                    if let Ok(ns_window_val) = win.ns_window() {
                        let ns_window = ns_window_val as id;
                        unsafe {
                            // MoveToActiveSpace (1<<1) + FullScreenAuxiliary (1<<4)
                            let behavior = (1 << 1) | (1 << 4);
                            let _: () = msg_send![ns_window, setCollectionBehavior:behavior];

                            // High level so it floats over EVERYTHING
                            let screen_saver_level = 1000;
                            let _: () = msg_send![ns_window, setLevel:screen_saver_level];
                        }
                    }
                }

                // Maximize so it covers the entire display
                win.maximize().ok();
                win.show().ok();
                win.set_focus().ok();
            }
            Err(e) => println!("OCR_SELECTION: creation failed with error: {:?}", e),
        }
    }
}

#[tauri::command]
fn open_ocr_result_window(app: tauri::AppHandle) {
    do_open_ocr_result_window(app);
}

pub(crate) fn do_open_ocr_result_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("ocr_result") {
        win.show().ok();
        win.set_focus().ok();
    } else {
        match tauri::WebviewWindowBuilder::new(
            &app,
            "ocr_result",
            tauri::WebviewUrl::App("/".into()),
        )
        .title("PixelPaw OCR Result")
        .inner_size(420.0, 500.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(true)
        .build()
        {
            Ok(win) => {
                #[cfg(target_os = "macos")]
                {
                    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
                    use cocoa::base::id;
                    use objc::{msg_send, sel, sel_impl};

                    if let Ok(ns_window_val) = win.ns_window() {
                        let ns_window = ns_window_val as id;
                        unsafe {
                            // NSWindowCollectionBehaviorMoveToActiveSpace
                            let _: () = msg_send![ns_window, setCollectionBehavior: 1 << 1];
                        }
                    }
                }
            }
            Err(e) => println!("OCR_RESULT: creation failed: {:?}", e),
        }
    }
}

#[tauri::command]
fn close_ocr_result_window(app: tauri::AppHandle) {
    do_close_ocr_result_window(app);
}

pub(crate) fn do_close_ocr_result_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("ocr_result") {
        win.close()
            .unwrap_or_else(|e| println!("Failed to close OCR result window: {:?}", e));
    }
}

#[tauri::command]
fn close_ocr_selection_window(app: tauri::AppHandle) {
    do_close_ocr_selection_window(app);
}

pub(crate) fn do_close_ocr_selection_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("ocr_selection") {
        win.close()
            .unwrap_or_else(|e| println!("Failed to close OCR selection window: {:?}", e));
    }
}

#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}

#[cfg(all(target_os = "macos", debug_assertions))]
fn run_macos_diagnostics(window: &tauri::WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;
    use cocoa::foundation::NSRect;
    use objc::{msg_send, sel, sel_impl};

    if let Ok(ns_window_val) = window.ns_window() {
        let ns_window = ns_window_val as id;
        unsafe {
            println!("==================================================");
            println!("PET NATIVE WINDOW DIAGNOSTICS");
            println!("==================================================");
            println!("Tauri label: {}", window.label());
            println!("NSWindow pointer: {:?}", ns_window);

            let ns_app: id = msg_send![objc::class!(NSApplication), sharedApplication];
            let activation_policy: i64 = msg_send![ns_app, activationPolicy];
            let policy_str = match activation_policy {
                0 => "NSApplicationActivationPolicyRegular",
                1 => "NSApplicationActivationPolicyAccessory",
                2 => "NSApplicationActivationPolicyProhibited",
                _ => "Unknown",
            };
            println!("activationPolicy: {} ({})", policy_str, activation_policy);

            let hides_on_deactivate: bool = msg_send![ns_window, hidesOnDeactivate];
            println!("hidesOnDeactivate: {}", hides_on_deactivate);

            let is_key: bool = msg_send![ns_window, isKeyWindow];
            println!("isKeyWindow: {}", is_key);

            let is_main: bool = msg_send![ns_window, isMainWindow];
            println!("isMainWindow: {}", is_main);

            let window_number: i64 = msg_send![ns_window, windowNumber];
            println!("windowNumber: {}", window_number);

            let level_before: i64 = msg_send![ns_window, level];
            println!("level before: {}", level_before);

            let levels_to_test = [3, 24, 25, 1000];
            for l in levels_to_test {
                let _: () = msg_send![ns_window, setLevel:l as i64];
                let read_back: i64 = msg_send![ns_window, level];
                println!("tested setting level {}, read back: {}", l, read_back);
            }

            // Final set: NSScreenSaverWindowLevel (1000)
            let final_level = 1000;
            let _: () = msg_send![ns_window, setLevel:final_level as i64];
            let level_after: i64 = msg_send![ns_window, level];
            println!("level after: {}", level_after);

            let alpha: f64 = msg_send![ns_window, alphaValue];
            println!("alpha: {}", alpha);

            let is_visible: bool = msg_send![ns_window, isVisible];
            println!("isVisible: {}", is_visible);

            let ignores_mouse: bool = msg_send![ns_window, ignoresMouseEvents];
            println!("ignoresMouseEvents: {}", ignores_mouse);

            let behavior: u64 = msg_send![ns_window, collectionBehavior];
            println!("collectionBehavior before: {}", behavior);

            let new_behavior =
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;
            ns_window.setCollectionBehavior_(new_behavior);

            let behavior_after: u64 = msg_send![ns_window, collectionBehavior];
            println!("collectionBehavior after: {}", behavior_after);

            let style_mask: u64 = msg_send![ns_window, styleMask];
            println!("styleMask: {}", style_mask);

            let frame: NSRect = msg_send![ns_window, frame];
            println!(
                "frame: x={}, y={}, w={}, h={}",
                frame.origin.x, frame.origin.y, frame.size.width, frame.size.height
            );

            let _: () = msg_send![ns_window, orderFrontRegardless];
            println!("orderFrontRegardless: executed");

            println!("==================================================");
        }
    }
}

// ─── Environment Awareness ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct EnvironmentInfo {
    cursor: CursorInfo,
    active_app: AppInfo,
    idle_seconds: f64,
}

#[derive(Serialize)]
pub struct CursorInfo {
    x: f64,
    y: f64,
}

#[derive(Serialize)]
pub struct AppInfo {
    name: String,
    bundle_id: String,
}

#[tauri::command]
fn get_environment_info() -> Option<EnvironmentInfo> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::id;
        use cocoa::foundation::{NSPoint, NSRect};
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            // 1. Cursor Location
            let ns_event_class = objc::class!(NSEvent);
            let loc: NSPoint = msg_send![ns_event_class, mouseLocation];

            // Convert bottom-left to top-left coordinate system using primary screen height
            let screen_class = objc::class!(NSScreen);
            let screens: id = msg_send![screen_class, screens];
            let primary_screen: id = msg_send![screens, objectAtIndex:0];
            let frame: NSRect = msg_send![primary_screen, frame];

            let cursor_x = loc.x;
            let cursor_y = frame.size.height - loc.y;

            // 2. Idle Time
            #[link(name = "CoreGraphics", kind = "framework")]
            extern "C" {
                fn CGEventSourceSecondsSinceLastEventType(source: u32, eventType: u32) -> f64;
            }
            let idle_seconds = CGEventSourceSecondsSinceLastEventType(1, 0xFFFFFFFF); // HIDSystemState, AnyInput

            // 3. Active Application
            let workspace: id = msg_send![objc::class!(NSWorkspace), sharedWorkspace];
            let active_app: id = msg_send![workspace, frontmostApplication];

            let name_id: id = msg_send![active_app, localizedName];
            let bundle_id_id: id = msg_send![active_app, bundleIdentifier];

            let name = if name_id.is_null() {
                String::new()
            } else {
                let bytes: *const u8 = msg_send![name_id, UTF8String];
                std::ffi::CStr::from_ptr(bytes as *const i8)
                    .to_string_lossy()
                    .into_owned()
            };

            let bundle_id = if bundle_id_id.is_null() {
                String::new()
            } else {
                let bytes: *const u8 = msg_send![bundle_id_id, UTF8String];
                std::ffi::CStr::from_ptr(bytes as *const i8)
                    .to_string_lossy()
                    .into_owned()
            };

            return Some(EnvironmentInfo {
                cursor: CursorInfo {
                    x: cursor_x,
                    y: cursor_y,
                },
                active_app: AppInfo { name, bundle_id },
                idle_seconds,
            });
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[tauri::command]
fn apply_pet_window_level(app: tauri::AppHandle, always_on_top: bool) {
    if let Some(window) = app.get_webview_window("pet") {
        #[cfg(target_os = "macos")]
        {
            use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
            use cocoa::base::id;
            use objc::{msg_send, sel, sel_impl};

            if let Ok(ns_window_val) = window.ns_window() {
                let ns_window = ns_window_val as id;
                let ns_window_ptr = ns_window as usize;

                // Move AppKit manipulations to the main thread
                app.run_on_main_thread(move || {
                    let ns_window = ns_window_ptr as id;
                    unsafe {
                        let panel_class = objc::class!(NSPanel);
                        extern "C" {
                            fn object_setClass(
                                obj: *mut objc::runtime::Object,
                                cls: *const objc::runtime::Class,
                            ) -> *const objc::runtime::Class;
                        }
                        object_setClass(ns_window as *mut objc::runtime::Object, panel_class);

                        let current_mask: u64 = msg_send![ns_window, styleMask];
                        let new_mask = current_mask | 128; // NSNonactivatingPanelMask
                        let _: () = msg_send![ns_window, setStyleMask:new_mask];

                        let level = if always_on_top { 1000 } else { 0 };
                        let _: () = msg_send![ns_window, setLevel:level];

                        let behavior: u64 = 341;
                        let _: () = msg_send![ns_window, setCollectionBehavior:behavior];

                        let _: () = msg_send![ns_window, setHidesOnDeactivate:false];

                        // We must ensure the window is floating.
                        // While setLevel does it, setting isFloatingPanel explicitly can help.
                        let _: () = msg_send![ns_window, setFloatingPanel:cocoa::base::YES];

                        // CRITICAL FOR HOVER: Accept mouse moved events
                        let _: () =
                            msg_send![ns_window, setAcceptsMouseMovedEvents:cocoa::base::YES];

                        let _: () = msg_send![ns_window, orderFrontRegardless];

                        // Print diagnostics to verify correct placement
                        let window_num: i64 = msg_send![ns_window, windowNumber];
                        let is_vis: bool = msg_send![ns_window, isVisible];
                        let lvl: i64 = msg_send![ns_window, level];
                        let cb: u64 = msg_send![ns_window, collectionBehavior];
                        let ordered_index: i64 = msg_send![ns_window, orderedIndex];

                        println!("PET NATIVE WINDOW DIAGNOSTICS:");
                        println!("windowNumber: {}", window_num);
                        println!("isVisible: {}", is_vis);
                        println!("level: {}", lvl);
                        println!("collectionBehavior: {}", cb);
                        println!("orderedIndex: {}", ordered_index);
                    }
                })
                .unwrap();
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            window.set_always_on_top(always_on_top).ok();
        }
    }
}

// ─── Setup Tray Icon ─────────────────────────────────────────────────────────

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let pause_item = MenuItem::with_id(app, "pause", "Pause Pet", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit PixelPaw", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;

    let about_item = MenuItem::with_id(app, "about", "About PixelPaw", true, None::<&str>)?;

    let status_submenu = Submenu::with_items(
        app,
        "Status",
        true,
        &[&MenuItem::with_id(
            app,
            "status_active",
            "● Pet Active",
            false,
            None::<&str>,
        )?],
    )?;

    let menu = Menu::with_items(
        app,
        &[
            &status_submenu,
            &separator,
            &pause_item,
            &settings_item,
            &separator2,
            &about_item,
            &quit_item,
        ],
    )?;

    // Use a simple built-in icon approach — we'll create a small PNG at build time
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("PixelPaw")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "pause" => {
                let state = app.state::<AppState>();
                let mut pet_state = state.pet_state.lock().unwrap();
                pet_state.is_paused = !pet_state.is_paused;
                let paused = pet_state.is_paused;
                drop(pet_state);
                app.emit("pet-pause-toggle", paused).ok();
            }
            "settings" => {
                // Open or focus settings window
                if let Some(win) = app.get_webview_window("settings") {
                    win.show().ok();
                    win.set_focus().ok();
                } else {
                    let _settings_win = WebviewWindowBuilder::new(
                        app,
                        "settings",
                        WebviewUrl::App("/settings".into()),
                    )
                    .title("PixelPaw Settings")
                    .inner_size(520.0, 640.0)
                    .resizable(true)
                    .decorations(true)
                    .center()
                    .build();
                }
            }
            "about" => {
                app.emit("show-about", ()).ok();
            }
            "quit" => {
                // Save state before quitting
                let state = app.state::<AppState>();
                let pet_state = state.pet_state.lock().unwrap();
                save_settings(&pet_state.settings);
                save_position(&pet_state.position);
                drop(pet_state);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("pet") {
                    win.show().ok();
                    win.set_focus().ok();
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ─── Main App ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let settings = load_settings();
    let position = load_position();

    let initial_state = PetState {
        settings,
        position,
        is_paused: false,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(pet_window) = app.get_webview_window("pet") {
                pet_window.set_focus().ok();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            pet_state: Mutex::new(initial_state),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            get_position,
            update_position,
            get_pet_paused,
            set_pet_paused,
            save_data,
            load_data,
            get_monitor_info,
            get_all_monitors,
            open_settings_window,
            show_reminder_window,
            test_reminder_window,
            open_ai_result_window,
            open_ocr_selection_window,
            open_ocr_result_window,
            apply_pet_window_level,
            get_environment_info,
            ai::ai_generate,
            ai::check_ollama,
            ai::test_gemini_connection,
            keychain::set_gemini_key,
            keychain::get_gemini_key,
            keychain::delete_gemini_key,
            keychain::has_gemini_key,
            ocr::process_ocr_selection,
            ocr::get_last_ocr_result,
            close_ocr_result_window,
            close_ocr_selection_window,
            quit_app,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            setup_tray(&handle)?;

            // Set initial position from saved state
            if let Some(pet_window) = app.get_webview_window("pet") {
                #[cfg(all(target_os = "macos", debug_assertions))]
                run_macos_diagnostics(&pet_window);

                let state = app.state::<AppState>();
                let pet_state = state.pet_state.lock().unwrap();
                let pos = &pet_state.position;
                pet_window
                    .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: pos.x as i32,
                        y: pos.y as i32,
                    }))
                    .ok();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "pet" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Don't actually close the pet window, just hide it
                    api.prevent_close();
                    window.hide().ok();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building PixelPaw")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
