use keyring::Entry;
use tauri::command;

const KEYRING_SERVICE: &str = "com.pixelpaw.app";
const GEMINI_KEY_NAME: &str = "gemini_api_key";

fn get_entry() -> Result<Entry, keyring::Error> {
    Entry::new(KEYRING_SERVICE, GEMINI_KEY_NAME)
}

#[command]
pub fn set_gemini_key(key: String) -> Result<(), String> {
    let entry = get_entry().map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[command]
pub fn get_gemini_key() -> Result<String, String> {
    let entry = get_entry().map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[command]
pub fn delete_gemini_key() -> Result<(), String> {
    let entry = get_entry().map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}

#[command]
pub fn has_gemini_key() -> bool {
    get_gemini_key().is_ok()
}
