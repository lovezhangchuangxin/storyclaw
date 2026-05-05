use bytes::Bytes;
use futures::{Stream, StreamExt};
use serde_json::Value;
use std::pin::Pin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};

/// Estimate prompt tokens from request body messages.
/// Uses the standard ~4 chars per token heuristic.
pub fn estimate_prompt_tokens(body: &Value) -> i64 {
    let messages = match body.get("messages").and_then(|m| m.as_array()) {
        Some(arr) => arr,
        None => return 500,
    };

    let total_chars: i64 = messages
        .iter()
        .filter_map(|msg| msg.get("content").and_then(|c| c.as_str()).map(|s| s.len() as i64))
        .sum();

    (total_chars / 4).max(100)
}

/// Pack prompt/completion tokens into a single u64 (each clamped to u32).
fn pack_usage(prompt: i64, completion: i64) -> u64 {
    let p = prompt.clamp(0, u32::MAX as i64) as u32;
    let c = completion.clamp(0, u32::MAX as i64) as u32;
    ((p as u64) << 32) | (c as u64)
}

/// Unpack a packed u64 into (prompt_tokens, completion_tokens).
pub fn unpack_usage(packed: u64) -> (i64, i64) {
    let prompt = ((packed >> 32) as u32) as i64;
    let completion = (packed as u32) as i64;
    (prompt, completion)
}

/// A stream wrapper that inspects SSE chunks for `usage` data without buffering.
/// Chunks pass through immediately; only usage info is extracted from the final chunk.
pub struct UsageInspectStream<S> {
    inner: S,
    usage_captured: Arc<AtomicU64>,
    buffer: Vec<u8>,
}

impl<S> UsageInspectStream<S> {
    pub fn new(inner: S) -> (Self, Arc<AtomicU64>) {
        let captured = Arc::new(AtomicU64::new(0));
        let stream = Self {
            inner,
            usage_captured: captured.clone(),
            buffer: Vec::with_capacity(4096),
        };
        (stream, captured)
    }

    fn scan_chunk_for_usage(&mut self, chunk: &Bytes) {
        self.buffer.extend_from_slice(chunk);

        while let Some(pos) = self.buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = self.buffer.drain(..=pos).collect();
            let line_str = String::from_utf8_lossy(&line);

            if let Some(data) = line_str.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    continue;
                }
                if data.contains("\"usage\"") {
                    if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                        if let Some(usage) = parsed.get("usage") {
                            let prompt = usage
                                .get("prompt_tokens")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            let completion = usage
                                .get("completion_tokens")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            self.usage_captured
                                .store(pack_usage(prompt, completion), Ordering::SeqCst);
                        }
                    }
                }
            }
        }

        // Prevent unbounded buffer growth
        if self.buffer.len() > 65536 {
            self.buffer.drain(..self.buffer.len() - 1024);
        }
    }
}

impl<S, E> Stream for UsageInspectStream<S>
where
    S: Stream<Item = Result<Bytes, E>> + Unpin,
{
    type Item = Result<Bytes, E>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        match self.inner.poll_next_unpin(cx) {
            Poll::Ready(Some(Ok(chunk))) => {
                self.scan_chunk_for_usage(&chunk);
                Poll::Ready(Some(Ok(chunk)))
            }
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}

/// A stream wrapper that fires a callback when the inner stream ends.
/// Uses `Drop` to guarantee the callback fires even on errors or client disconnects.
pub struct AccountingStream<S, F: FnOnce()> {
    inner: S,
    on_complete: Option<F>,
}

impl<S, F: FnOnce()> AccountingStream<S, F> {
    pub fn new(inner: S, on_complete: F) -> Self {
        Self {
            inner,
            on_complete: Some(on_complete),
        }
    }
}

impl<S, F: FnOnce()> Drop for AccountingStream<S, F> {
    fn drop(&mut self) {
        if let Some(cb) = self.on_complete.take() {
            cb();
        }
    }
}

impl<S, F: FnOnce() + Unpin, E> Stream for AccountingStream<S, F>
where
    S: Stream<Item = Result<Bytes, E>> + Unpin,
{
    type Item = Result<Bytes, E>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        match self.inner.poll_next_unpin(cx) {
            Poll::Ready(None) => {
                // Normal end — callback fires via Drop when self is dropped
                Poll::Ready(None)
            }
            Poll::Ready(Some(Ok(chunk))) => Poll::Ready(Some(Ok(chunk))),
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e))),
            Poll::Pending => Poll::Pending,
        }
    }
}
