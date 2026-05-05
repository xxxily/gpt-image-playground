/// SSE event types from OpenAI-compatible image generation/editing streams.
use serde::{Deserialize, Serialize};

/// Parsed SSE event from OpenAI image generation/edit streaming.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SseEventType {
    ImageGenerationPartialImage,
    ImageGenerationCompleted,
    ImageEditPartialImage,
    ImageEditCompleted,
    Error,
    Done,
}

impl SseEventType {
    pub fn from_event_type(value: &str) -> Option<Self> {
        match value {
            "image_generation.partial_image" => Some(Self::ImageGenerationPartialImage),
            "image_generation.completed" => Some(Self::ImageGenerationCompleted),
            "image_edit.partial_image" => Some(Self::ImageEditPartialImage),
            "image_edit.completed" => Some(Self::ImageEditCompleted),
            "error" => Some(Self::Error),
            "done" => Some(Self::Done),
            _ => None,
        }
    }
}

/// A single parsed SSE event with its event type and JSON data.
#[derive(Debug, Clone)]
pub struct SseEvent {
    pub event_type: SseEventType,
    pub data: serde_json::Value,
}

/// Parse SSE text into individual events.
///
/// Handles multi-line SSE blocks separated by double newlines.
/// Each block should have `event: <type>` and `data: <json>` lines.
pub fn parse_sse_events(text: &str) -> Vec<SseEvent> {
    let mut events = Vec::new();
    for block in text.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut event_type: Option<String> = None;
        let mut data_lines = Vec::new();

        for line in block.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("event: ") {
                event_type = Some(rest.trim().to_string());
            } else if let Some(rest) = line.strip_prefix("data: ") {
                data_lines.push(rest.trim());
            } else if line.starts_with(':') || line.is_empty() {
            }
        }

        if let (Some(ev_type), Some(data_str)) = (event_type, data_lines.first()) {
            if let Some(parsed_type) = SseEventType::from_event_type(&ev_type) {
                let full_data = if data_lines.len() > 1 {
                    data_lines.join("\n")
                } else {
                    data_lines[0].to_string()
                };

                if let Ok(json) = serde_json::from_str(&full_data) {
                    events.push(SseEvent {
                        event_type: parsed_type,
                        data: json,
                    });
                }
            }
        }
    }

    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_partial_image_event() {
        let sse = "event: image_generation.partial_image\ndata: {\"index\":0,\"b64_json\":\"abc\"}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0].event_type, SseEventType::ImageGenerationPartialImage));
        assert_eq!(events[0].data["index"], 0);
        assert_eq!(events[0].data["b64_json"], "abc");
    }

    #[test]
    fn parses_completed_event() {
        let sse = "event: image_generation.completed\ndata: {\"index\":0,\"b64_json\":\"xyz\"}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0].event_type, SseEventType::ImageGenerationCompleted));
    }

    #[test]
    fn parses_edit_partial_image_event() {
        let sse = "event: image_edit.partial_image\ndata: {\"index\":0,\"b64_json\":\"def\"}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0].event_type, SseEventType::ImageEditPartialImage));
    }

    #[test]
    fn parses_error_event() {
        let sse = "event: error\ndata: {\"error\":{\"message\":\"test error\"}}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0].event_type, SseEventType::Error));
        assert_eq!(events[0].data["error"]["message"], "test error");
    }

    #[test]
    fn parses_done_event() {
        let sse = "event: done\ndata: {\"images\":[],\"usage\":{}}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0].event_type, SseEventType::Done));
    }

    #[test]
    fn parses_multiple_events() {
        let sse = "event: image_generation.partial_image\ndata: {\"index\":0}\n\n\
                   event: image_generation.completed\ndata: {\"index\":0}\n\n\
                   event: done\ndata: {}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 3);
        assert!(matches!(events[0].event_type, SseEventType::ImageGenerationPartialImage));
        assert!(matches!(events[1].event_type, SseEventType::ImageGenerationCompleted));
        assert!(matches!(events[2].event_type, SseEventType::Done));
    }

    #[test]
    fn ignores_unknown_event_type() {
        let sse = "event: unknown_event\ndata: {}";
        let events = parse_sse_events(sse);
        assert!(events.is_empty());
    }

    #[test]
    fn ignores_comments_and_empty_blocks() {
        let sse = ": this is a comment\n\n\
                   event: done\ndata: {}";
        let events = parse_sse_events(sse);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn handles_malformed_data_gracefully() {
        let sse = "event: done\ndata: {invalid json}";
        let events = parse_sse_events(sse);
        assert!(events.is_empty());
    }

    #[test]
    fn handles_missing_data_line() {
        let sse = "event: done\n";
        let events = parse_sse_events(sse);
        assert!(events.is_empty());
    }

    #[test]
    fn from_event_type_variants() {
        assert!(SseEventType::from_event_type("image_generation.partial_image").is_some());
        assert!(SseEventType::from_event_type("image_generation.completed").is_some());
        assert!(SseEventType::from_event_type("image_edit.partial_image").is_some());
        assert!(SseEventType::from_event_type("image_edit.completed").is_some());
        assert!(SseEventType::from_event_type("error").is_some());
        assert!(SseEventType::from_event_type("done").is_some());
        assert!(SseEventType::from_event_type("custom").is_none());
    }
}
