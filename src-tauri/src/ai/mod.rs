use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::command;

use crate::keychain::get_gemini_key;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIMessage {
    pub role: String, // "user", "assistant" (or "model" for Gemini)
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub messages: Option<Vec<AIMessage>>,
    pub model: Option<String>,
    pub provider: String, // "OLLAMA" or "GEMINI"
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIResponse {
    pub text: String,
    pub provider: String,
    pub model: String,
    pub duration_ms: u64,
}

#[command]
pub async fn ai_generate(request: AIRequest) -> Result<AIResponse, String> {
    let start = Instant::now();
    let client = Client::new();

    match request.provider.as_str() {
        "OLLAMA" => {
            let model = request.model.unwrap_or_else(|| "qwen2.5:0.5b".to_string());

            #[derive(Serialize)]
            struct OllamaMessage {
                role: String,
                content: String,
            }

            #[derive(Serialize)]
            struct OllamaRequest {
                model: String,
                messages: Vec<OllamaMessage>,
                stream: bool,
                options: serde_json::Value,
            }

            let mut messages = Vec::new();
            if let Some(sp) = &request.system_prompt {
                messages.push(OllamaMessage {
                    role: "system".to_string(),
                    content: sp.clone(),
                });
            }
            if let Some(history) = &request.messages {
                for m in history {
                    messages.push(OllamaMessage {
                        role: m.role.clone(),
                        content: m.content.clone(),
                    });
                }
            }
            if !request.prompt.is_empty() {
                messages.push(OllamaMessage {
                    role: "user".to_string(),
                    content: request.prompt.clone(),
                });
            }

            let body = OllamaRequest {
                model: model.clone(),
                messages,
                stream: false,
                options: serde_json::json!({
                    "temperature": request.temperature.unwrap_or(0.7)
                }),
            };

            let res = client
                .post("http://127.0.0.1:11434/api/chat")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Ollama request failed: {}", e))?;

            let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

            if let Some(error) = json.get("error") {
                return Err(format!("Ollama API Error: {:?}", error));
            }

            let text = json["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string();

            Ok(AIResponse {
                text,
                provider: "OLLAMA".to_string(),
                model,
                duration_ms: start.elapsed().as_millis() as u64,
            })
        }
        "GEMINI" => {
            let api_key =
                get_gemini_key().map_err(|_| "Gemini API key not found in keychain".to_string())?;
            let model = request
                .model
                .clone()
                .ok_or_else(|| "Gemini model is required".to_string())?;

            #[derive(Serialize)]
            struct GeminiPart {
                text: String,
            }
            #[derive(Serialize)]
            struct GeminiContent {
                parts: Vec<GeminiPart>,
                role: String,
            }

            let mut contents = Vec::new();
            if let Some(history) = &request.messages {
                for m in history {
                    let role = if m.role == "assistant" { "model" } else { "user" };
                    contents.push(GeminiContent {
                        role: role.to_string(),
                        parts: vec![GeminiPart {
                            text: m.content.clone(),
                        }],
                    });
                }
            }
            
            if !request.prompt.is_empty() {
                contents.push(GeminiContent {
                    role: "user".to_string(),
                    parts: vec![GeminiPart {
                        text: request.prompt.clone(),
                    }],
                });
            }

            let mut system_instruction = None;
            if let Some(sp) = &request.system_prompt {
                system_instruction = Some(serde_json::json!({
                    "parts": [{ "text": sp }]
                }));
            }

            let body = serde_json::json!({
                "contents": contents,
                "systemInstruction": system_instruction,
                "generationConfig": {
                    "temperature": request.temperature.unwrap_or(0.7)
                }
            });

            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );

            let res = client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Gemini request failed: {}", e))?;

            let status = res.status();

            let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

            if !status.is_success() {
                if let Some(error) = json.get("error") {
                    if let Some(msg) = error.get("message") {
                        return Err(format!(
                            "Gemini request failed: HTTP {} — {}",
                            status,
                            msg.as_str().unwrap_or("Unknown error")
                        ));
                    }
                    return Err(format!(
                        "Gemini request failed: HTTP {} — {:?}",
                        status, error
                    ));
                }
                return Err(format!("Gemini request failed: HTTP {}", status));
            }

            if let Some(error) = json.get("error") {
                return Err(format!("Gemini API Error: {:?}", error));
            }

            let text = json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string();

            Ok(AIResponse {
                text,
                provider: "GEMINI".to_string(),
                model,
                duration_ms: start.elapsed().as_millis() as u64,
            })
        }
        _ => Err(format!("Unknown AI provider: {}", request.provider)),
    }
}

#[command]
pub async fn check_ollama() -> bool {
    let client = Client::new();
    match client
        .get("http://127.0.0.1:11434/api/version")
        .send()
        .await
    {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}

#[command]
pub async fn test_gemini_connection(model: String) -> Result<serde_json::Value, String> {
    println!("[GEMINI TEST RUST] command invoked");
    println!("[GEMINI TEST RUST] model={}", model);
    println!("[GEMINI TEST RUST] keychain lookup started");

    let api_key = match get_gemini_key() {
        Ok(key) => {
            println!("[GEMINI TEST RUST] keychain key present=true");
            key
        }
        Err(_) => {
            println!("[GEMINI TEST RUST] keychain key present=false");
            println!("[GEMINI TEST RUST] FAILED: Gemini API key not found in keychain");
            return Ok(serde_json::json!({
                "success": false,
                "provider": "GEMINI",
                "model": model,
                "message": "Gemini API key not found in keychain"
            }));
        }
    };

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let body = serde_json::json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": "Hello" }]
        }],
        "generationConfig": {
            "maxOutputTokens": 10
        }
    });

    println!("[GEMINI TEST RUST] HTTP request started");
    let res = match client.post(&url).json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            println!("[GEMINI TEST RUST] FAILED: Network error {}", e);
            return Ok(serde_json::json!({
                "success": false,
                "provider": "GEMINI",
                "model": model,
                "message": format!("Network error: {}", e)
            }));
        }
    };

    let status = res.status();
    println!("[GEMINI TEST RUST] HTTP status={}", status);

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let mut msg = format!("HTTP {}", status);
        if let Some(error) = json.get("error") {
            if let Some(err_msg) = error.get("message") {
                msg = format!(
                    "{} (HTTP {})",
                    err_msg.as_str().unwrap_or("Unknown error"),
                    status
                );
            } else {
                msg = format!("{:?} (HTTP {})", error, status);
            }
        }
        println!("[GEMINI TEST RUST] FAILED: {}", msg);
        return Ok(serde_json::json!({
            "success": false,
            "provider": "GEMINI",
            "model": model,
            "status": status.as_u16(),
            "message": msg
        }));
    }

    println!("[GEMINI TEST RUST] success");
    Ok(serde_json::json!({
        "success": true,
        "provider": "GEMINI",
        "model": model,
        "message": "Gemini connection successful"
    }))
}
