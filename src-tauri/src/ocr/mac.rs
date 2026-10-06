use super::OCRResult;
use cocoa::base::{id, nil};
use cocoa::foundation::{NSString, NSUInteger};
use objc::runtime::YES;
use objc::{class, msg_send, sel, sel_impl};
use std::process::Command;

#[link(name = "Vision", kind = "framework")]
extern "C" {}

pub fn perform_ocr_mac(x: f64, y: f64, w: f64, h: f64) -> OCRResult {
    let start = std::time::Instant::now();
    let temp_path = "/tmp/pixelpaw_ocr_capture.png";

    let rect_str = format!(
        "{},{},{},{}",
        x.round() as i32,
        y.round() as i32,
        w.round() as i32,
        h.round() as i32
    );
    let output = match Command::new("screencapture")
        .args(&["-R", &rect_str, "-x", temp_path])
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            return OCRResult {
                success: false,
                text: String::new(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Failed to launch screencapture: {}", e)),
            }
        }
    };

    if !output.status.success() {
        return OCRResult {
            success: false,
            text: String::new(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(
                "Screen capture failed. Check Screen Recording permissions in System Settings."
                    .to_string(),
            ),
        };
    }

    let text = match extract_text_from_image(temp_path) {
        Ok(t) => t,
        Err(e) => {
            return OCRResult {
                success: false,
                text: String::new(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(e),
            }
        }
    };

    let _ = std::fs::remove_file(temp_path);

    OCRResult {
        success: true,
        text,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
    }
}

fn extract_text_from_image(path: &str) -> Result<String, String> {
    unsafe {
        let path_str = NSString::alloc(nil).init_str(path);
        let url_class = class!(NSURL);
        let url: id = msg_send![url_class, fileURLWithPath:path_str];

        let handler_class = class!(VNImageRequestHandler);
        let handler_alloc: id = msg_send![handler_class, alloc];
        // VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithURL:url options:@{}];
        let handler: id = msg_send![handler_alloc, initWithURL:url options:nil];

        let request_class = class!(VNRecognizeTextRequest);
        let request_alloc: id = msg_send![request_class, alloc];
        let request: id = msg_send![request_alloc, init];

        // VNRequestTextRecognitionLevelAccurate = 0
        let _: () = msg_send![request, setRecognitionLevel:0_isize];
        let _: () = msg_send![request, setUsesLanguageCorrection:YES];

        let array_class = class!(NSArray);
        let requests_array: id = msg_send![array_class, arrayWithObject:request];

        let mut error: id = nil;
        let success: bool = msg_send![handler, performRequests:requests_array error:&mut error];

        if !success {
            return Err("Apple Vision OCR request failed.".to_string());
        }

        let results: id = msg_send![request, results];
        let count: NSUInteger = msg_send![results, count];

        let mut full_text = String::new();
        for i in 0..count {
            let observation: id = msg_send![results, objectAtIndex:i];
            let top_candidates: id = msg_send![observation, topCandidates:1_usize];
            let candidates_count: NSUInteger = msg_send![top_candidates, count];

            if candidates_count > 0 {
                let candidate: id = msg_send![top_candidates, objectAtIndex:0_usize];
                let string_ptr: id = msg_send![candidate, string];

                let c_string: *const std::os::raw::c_char = msg_send![string_ptr, UTF8String];
                if !c_string.is_null() {
                    let c_str = std::ffi::CStr::from_ptr(c_string);
                    if let Ok(s) = c_str.to_str() {
                        if !full_text.is_empty() {
                            full_text.push('\n');
                        }
                        full_text.push_str(s);
                    }
                }
            }
        }

        Ok(full_text)
    }
}
