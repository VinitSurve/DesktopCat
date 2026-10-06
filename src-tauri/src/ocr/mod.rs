use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    pub success: bool,
    pub text: String,
    pub duration_ms: u64,
    pub error: Option<String>,
}

static LAST_OCR_RESULT: Mutex<Option<OCRResult>> = Mutex::new(None);

#[tauri::command]
pub async fn get_last_ocr_result() -> Result<Option<OCRResult>, String> {
    Ok(LAST_OCR_RESULT.lock().unwrap().clone())
}

#[tauri::command]
pub async fn process_ocr_selection(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    // 1. Destroy selection window
    if let Some(win) = app.get_webview_window("ocr_selection") {
        let _ = win.close();
    }

    // 2. Wait for it to disappear from screen
    std::thread::sleep(std::time::Duration::from_millis(300));

    #[cfg(target_os = "macos")]
    {
        let res = mac::perform_ocr_mac(x, y, w, h);
        *LAST_OCR_RESULT.lock().unwrap() = Some(res);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let res = OCRResult {
            success: false,
            text: String::new(),
            duration_ms: 0,
            error: Some("OCR is only supported on macOS right now.".to_string()),
        };
        *LAST_OCR_RESULT.lock().unwrap() = Some(res);
    }

    // 3. Open result window
    crate::do_open_ocr_result_window(app);
    Ok(())
}

#[cfg(target_os = "macos")]
pub mod mac;
