//! The desktop side of the local inference lane.
//!
//! NeuronForge Local holds inference responsibility. VibeForge holds developer
//! authority. This module is the trusted bridge between them, and it exists
//! because the webview cannot be a caller at all: the service's
//! `LocalCallerBoundary` denies any request carrying an `Origin` header with
//! 403 `invalid_local_caller`, before parsing a body or touching a device, and
//! a browser sends `Origin` on this request.
//!
//! The capability lives here and only here. The service's boundary states that
//! the supervisor gives it to a service and its trusted proxy, never the
//! webview, so it is read from the process environment and never returned
//! across the IPC boundary.
//!
//! Shapes are pinned to `service/nf_node_api.py` and
//! `service/local_caller_boundary.py` in `forge-neuronforge`, and mirror
//! `src/lib/core/neuronforge/` on the TypeScript side.
//!
//! This slice performs readiness only. It issues no execution.

use serde::Serialize;

/// The loopback authority the sidecar binds. The Forge port registry assigns
/// it 8027.
pub const DEFAULT_AUTHORITY: &str = "127.0.0.1:8027";

/// The header the service's boundary compares the capability against.
pub const CAPABILITY_HEADER: &str = "X-AuthorForge-NeuronForge-Capability";

/// The variable the capability is read from. Deliberately not `VITE_`-prefixed:
/// Vite inlines every `VITE_` variable into client JavaScript, which would
/// publish the capability to anyone who loads the application.
pub const CAPABILITY_ENV_VAR: &str = "NEURONFORGE_LOCAL_CAPABILITY";

/// What the service accepts, from its own boundary: `[A-Za-z0-9_-]{32,512}`.
fn capability_is_well_formed(value: &str) -> bool {
    let length = value.chars().count();
    (32..=512).contains(&length)
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Why a readiness attempt could not even be made.
#[derive(Debug, PartialEq, Eq)]
pub enum BridgeSetupError {
    /// The variable is absent or empty.
    CapabilityMissing,
    /// Present but not the shape the service accepts, so it would be refused.
    CapabilityMalformed,
}

/// Reads the capability without copying it anywhere else.
///
/// The shape is checked here so a malformed value is reported as a local
/// configuration fault rather than sent and rejected as a 401, which would
/// read as the wrong problem.
pub fn read_capability() -> Result<String, BridgeSetupError> {
    let value = std::env::var(CAPABILITY_ENV_VAR).unwrap_or_default();
    if value.is_empty() {
        return Err(BridgeSetupError::CapabilityMissing);
    }
    if !capability_is_well_formed(&value) {
        return Err(BridgeSetupError::CapabilityMalformed);
    }
    Ok(value)
}

/// The refusals the service's boundary produces.
///
/// Each is a different problem with a different remedy, so they are reported
/// separately rather than collapsed into "unavailable".
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Refusal {
    /// 403. An `Origin` header, or a host that is not loopback.
    InvalidLocalCaller,
    /// 401. The capability was absent, duplicated, or did not match.
    LocalCapabilityRequired,
    /// 503. The service has no usable capability to compare against.
    LocalCapabilityUnconfigured,
    /// 415. A POST without exactly one `application/json` content type.
    ApplicationJsonRequired,
}

impl Refusal {
    /// Maps a refusal status to its reason. Returns `None` for any other code.
    pub fn from_status(status: u16) -> Option<Self> {
        match status {
            403 => Some(Self::InvalidLocalCaller),
            401 => Some(Self::LocalCapabilityRequired),
            503 => Some(Self::LocalCapabilityUnconfigured),
            415 => Some(Self::ApplicationJsonRequired),
            _ => None,
        }
    }
}

/// What the developer is told about the lane.
///
/// Mirrors `LocalLaneState` in `src/lib/core/neuronforge/bridge.ts`. No variant
/// means "probably fine", and there is no cloud fallback.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LaneState {
    Ready {
        models: Vec<String>,
        /// Renamed on the wire because the webview reads this key directly and
        /// TypeScript names it `residentModels`. A mismatch here is silent:
        /// the key is simply absent over there. The shared fixture and the
        /// parity test in `tests.rs` are what keep the two honest.
        #[serde(rename = "residentModels")]
        resident_models: Vec<String>,
    },
    RuntimeDegraded {
        reason: String,
    },
    Refused {
        refusal: Refusal,
        status: u16,
    },
    Unreachable {
        detail: String,
    },
    /// The bridge itself cannot act: no capability, or a malformed one.
    BridgeUnconfigured {
        reason: String,
    },
}

/// One loopback GET. Separated so the mapping below is testable without a
/// server, and so the real client stays thin enough to read in one sitting.
pub trait NfNodeTransport {
    /// Returns the status and body, or a transport-level failure.
    fn get(&self, path: &str) -> Result<(u16, String), String>;
}

/// Resolves the lane state from the node's answers.
///
/// Reads the body, never the status code alone. `/nf-node/health` answers 200
/// with `status: "degraded"` when the runtime is down, and that route's own
/// documentation says the status code must never be read as "Ollama is up", so
/// a caller keyed on the code would report a healthy lane over a dead runtime.
pub fn resolve_lane_state(transport: &impl NfNodeTransport) -> LaneState {
    let health = match transport.get("/nf-node/health") {
        Ok(response) => response,
        Err(detail) => return LaneState::Unreachable { detail },
    };

    if let Some(refusal) = Refusal::from_status(health.0) {
        return LaneState::Refused {
            refusal,
            status: health.0,
        };
    }

    let health_body: serde_json::Value = match serde_json::from_str(&health.1) {
        Ok(value) => value,
        Err(error) => {
            return LaneState::Unreachable {
                detail: format!("health response was not JSON: {error}"),
            };
        }
    };

    if health_body.get("status").and_then(|s| s.as_str()) != Some("ok") {
        return LaneState::RuntimeDegraded {
            reason: health_body
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("degraded")
                .to_string(),
        };
    }

    let capabilities = match transport.get("/nf-node/capabilities") {
        Ok(response) => response,
        Err(detail) => return LaneState::Unreachable { detail },
    };

    if let Some(refusal) = Refusal::from_status(capabilities.0) {
        return LaneState::Refused {
            refusal,
            status: capabilities.0,
        };
    }

    let body: serde_json::Value = match serde_json::from_str(&capabilities.1) {
        Ok(value) => value,
        Err(error) => {
            return LaneState::Unreachable {
                detail: format!("capabilities response was not JSON: {error}"),
            };
        }
    };

    if body.get("health_status").and_then(|s| s.as_str()) != Some("ok") {
        return LaneState::RuntimeDegraded {
            reason: body
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("offline")
                .to_string(),
        };
    }

    LaneState::Ready {
        models: string_list(body.get("available_models")),
        resident_models: body
            .get("resident_models")
            .and_then(|m| m.as_array())
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(|entry| entry.get("name").and_then(|n| n.as_str()))
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
    }
}

fn string_list(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests;

/// The real transport: two loopback GETs carrying the capability.
///
/// Sends no `Origin` header, which is what lets this reach the node at all.
/// The URL is built from a fixed loopback authority rather than configuration,
/// so no setting can redirect the capability to another host.
pub struct LoopbackTransport {
    authority: String,
    capability: String,
}

impl LoopbackTransport {
    /// Builds a transport for the default loopback authority.
    pub fn new(capability: String) -> Self {
        Self {
            authority: DEFAULT_AUTHORITY.to_string(),
            capability,
        }
    }

    /// Used by tests to point at a throwaway listener. Loopback only.
    #[cfg(test)]
    fn with_authority(authority: String, capability: String) -> Self {
        Self {
            authority,
            capability,
        }
    }
}

impl NfNodeTransport for LoopbackTransport {
    fn get(&self, path: &str) -> Result<(u16, String), String> {
        let url = format!("http://{}{}", self.authority, path);
        match ureq::get(&url)
            .set(CAPABILITY_HEADER, &self.capability)
            .call()
        {
            Ok(response) => {
                let status = response.status();
                let body = response.into_string().unwrap_or_default();
                Ok((status, body))
            }
            // A refusal arrives as an error status, and is a real answer from
            // the node rather than a transport failure, so it is passed through
            // for `resolve_lane_state` to classify.
            Err(ureq::Error::Status(status, response)) => {
                Ok((status, response.into_string().unwrap_or_default()))
            }
            Err(error) => Err(error.to_string()),
        }
    }
}

/// Reports the local lane's state to the developer.
///
/// Returns the state only. The capability never crosses this boundary, and a
/// configuration fault is reported as its own state rather than as a refusal,
/// because the remedies differ.
#[tauri::command]
pub fn neuronforge_lane_state() -> LaneState {
    let capability = match read_capability() {
        Ok(value) => value,
        Err(BridgeSetupError::CapabilityMissing) => {
            return LaneState::BridgeUnconfigured {
                reason: format!("{CAPABILITY_ENV_VAR} is not set"),
            };
        }
        Err(BridgeSetupError::CapabilityMalformed) => {
            return LaneState::BridgeUnconfigured {
                reason: format!(
                    "{CAPABILITY_ENV_VAR} is not the shape the node accepts, 32 to 512 characters of [A-Za-z0-9_-]"
                ),
            };
        }
    };

    resolve_lane_state(&LoopbackTransport::new(capability))
}
