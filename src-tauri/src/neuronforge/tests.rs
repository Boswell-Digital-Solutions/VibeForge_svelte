//! Tests for the local inference bridge.
//!
//! The transport is faked, so these exercise the mapping rather than a server.
//! The shapes the fake returns are copied from `service/nf_node_api.py`.

use super::*;
use std::cell::RefCell;

/// Answers each path from a script, and records what was asked.
struct FakeTransport {
    health: Result<(u16, String), String>,
    capabilities: Result<(u16, String), String>,
    asked: RefCell<Vec<String>>,
}

impl FakeTransport {
    fn new(health: (u16, &str), capabilities: (u16, &str)) -> Self {
        Self {
            health: Ok((health.0, health.1.to_string())),
            capabilities: Ok((capabilities.0, capabilities.1.to_string())),
            asked: RefCell::new(Vec::new()),
        }
    }
}

impl NfNodeTransport for FakeTransport {
    fn get(&self, path: &str) -> Result<(u16, String), String> {
        self.asked.borrow_mut().push(path.to_string());
        match path {
            "/nf-node/health" => self.health.clone(),
            "/nf-node/capabilities" => self.capabilities.clone(),
            other => Err(format!("unexpected path {other}")),
        }
    }
}

const HEALTH_OK: &str = r#"{"status":"ok","runtime":"ollama","model_count":2}"#;
const CAPS_OK: &str = r#"{"health_status":"ok","available_models":["llama3","qwen2.5"],
    "resident_models":[{"name":"llama3","size_vram":1,"expires_at":null}]}"#;

#[test]
fn reports_ready_with_available_and_resident_models() {
    let transport = FakeTransport::new((200, HEALTH_OK), (200, CAPS_OK));
    assert_eq!(
        resolve_lane_state(&transport),
        LaneState::Ready {
            models: vec!["llama3".into(), "qwen2.5".into()],
            resident_models: vec!["llama3".into()],
        }
    );
    assert_eq!(
        *transport.asked.borrow(),
        vec!["/nf-node/health", "/nf-node/capabilities"]
    );
}

// The discipline this module exists to keep. The service answers 200 with
// status "degraded" when the runtime is down, so a caller reading the status
// code would report a healthy lane over a dead runtime.
#[test]
fn does_not_report_ready_when_the_health_body_says_degraded() {
    let degraded = r#"{"status":"degraded","runtime":"ollama","error":"ollama_unreachable"}"#;
    let transport = FakeTransport::new((200, degraded), (200, CAPS_OK));
    assert_eq!(
        resolve_lane_state(&transport),
        LaneState::RuntimeDegraded {
            reason: "ollama_unreachable".into()
        }
    );
    // It must not have gone on to ask for capabilities.
    assert_eq!(*transport.asked.borrow(), vec!["/nf-node/health"]);
}

#[test]
fn does_not_report_ready_when_capabilities_says_offline() {
    let offline =
        r#"{"health_status":"offline","available_models":[],"error":"ollama_unreachable"}"#;
    let transport = FakeTransport::new((200, HEALTH_OK), (200, offline));
    assert_eq!(
        resolve_lane_state(&transport),
        LaneState::RuntimeDegraded {
            reason: "ollama_unreachable".into()
        }
    );
}

#[test]
fn surfaces_each_refusal_separately() {
    for (status, expected) in [
        (403u16, Refusal::InvalidLocalCaller),
        (401, Refusal::LocalCapabilityRequired),
        (503, Refusal::LocalCapabilityUnconfigured),
        (415, Refusal::ApplicationJsonRequired),
    ] {
        let transport = FakeTransport::new((status, "{}"), (200, CAPS_OK));
        assert_eq!(
            resolve_lane_state(&transport),
            LaneState::Refused {
                refusal: expected,
                status
            },
            "status {status} must map to its own refusal"
        );
    }
}

#[test]
fn a_refusal_on_capabilities_is_also_surfaced() {
    let transport = FakeTransport::new((200, HEALTH_OK), (401, "{}"));
    assert_eq!(
        resolve_lane_state(&transport),
        LaneState::Refused {
            refusal: Refusal::LocalCapabilityRequired,
            status: 401
        }
    );
}

#[test]
fn an_unknown_status_is_not_read_as_a_refusal() {
    assert_eq!(Refusal::from_status(200), None);
    assert_eq!(Refusal::from_status(500), None);
}

#[test]
fn distinguishes_nothing_answering_from_a_refusal() {
    struct Dead;
    impl NfNodeTransport for Dead {
        fn get(&self, _: &str) -> Result<(u16, String), String> {
            Err("connection refused".into())
        }
    }
    assert_eq!(
        resolve_lane_state(&Dead),
        LaneState::Unreachable {
            detail: "connection refused".into()
        }
    );
}

#[test]
fn a_non_json_body_is_unreachable_rather_than_ready() {
    let transport = FakeTransport::new((200, "<html>proxy error</html>"), (200, CAPS_OK));
    match resolve_lane_state(&transport) {
        LaneState::Unreachable { detail } => assert!(detail.contains("not JSON")),
        other => panic!("expected Unreachable, got {other:?}"),
    }
}

#[test]
fn capability_shape_matches_what_the_service_accepts() {
    // The service's boundary requires [A-Za-z0-9_-]{32,512}.
    assert!(capability_is_well_formed(&"a".repeat(32)));
    assert!(capability_is_well_formed(&"a".repeat(512)));
    assert!(capability_is_well_formed(
        "Ab3dEf7hIj1lMn5pQr9tUv2xYz4bCd8e_-"
    ));

    assert!(!capability_is_well_formed(&"a".repeat(31)), "too short");
    assert!(!capability_is_well_formed(&"a".repeat(513)), "too long");
    assert!(!capability_is_well_formed(""), "empty");
    assert!(
        !capability_is_well_formed(&format!("{} ", "a".repeat(32))),
        "a space is not accepted by the service"
    );
    assert!(
        !capability_is_well_formed(&format!("{}!", "a".repeat(32))),
        "punctuation is not accepted by the service"
    );
}

#[test]
fn the_pinned_constants_match_the_service() {
    assert_eq!(DEFAULT_AUTHORITY, "127.0.0.1:8027");
    assert_eq!(CAPABILITY_HEADER, "X-AuthorForge-NeuronForge-Capability");
    assert_eq!(CAPABILITY_ENV_VAR, "NEURONFORGE_LOCAL_CAPABILITY");
    // Not VITE_-prefixed, or Vite would inline it into the browser bundle.
    assert!(!CAPABILITY_ENV_VAR.starts_with("VITE_"));
}

#[test]
fn no_lane_state_serialises_to_something_mistakable_for_ready() {
    for state in [
        LaneState::RuntimeDegraded { reason: "x".into() },
        LaneState::Refused {
            refusal: Refusal::LocalCapabilityRequired,
            status: 401,
        },
        LaneState::Unreachable { detail: "y".into() },
        LaneState::BridgeUnconfigured { reason: "z".into() },
    ] {
        let json = serde_json::to_string(&state).expect("serialises");
        assert!(!json.contains("\"ready\""), "{json} must not read as ready");
    }
}

/// Serves one request from a throwaway loopback listener and hands back the
/// raw request bytes, so the test can assert the exact shape that went out.
fn serve_once(response_body: &'static str) -> (String, std::sync::mpsc::Receiver<String>) {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind loopback");
    let authority = listener.local_addr().expect("addr").to_string();
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buffer = [0u8; 4096];
            let read = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..read]).to_string();
            let _ = tx.send(request);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            let _ = stream.write_all(response.as_bytes());
        }
    });

    (authority, rx)
}

#[test]
fn the_request_carries_the_capability_and_no_origin() {
    let (authority, requests) = serve_once(HEALTH_OK);
    let capability = "Ab3dEf7hIj1lMn5pQr9tUv2xYz4bCd8e".to_string();
    let transport = LoopbackTransport::with_authority(authority, capability.clone());

    let (status, body) = transport.get("/nf-node/health").expect("a response");
    assert_eq!(status, 200);
    assert!(body.contains("\"status\":\"ok\""));

    let request = requests.recv().expect("the request was captured");

    // The capability must be present, because every route but /health needs it.
    assert!(
        request.contains(&format!("{CAPABILITY_HEADER}: {capability}")),
        "the capability header was not sent:\n{request}"
    );

    // An Origin header is what the service refuses with 403
    // invalid_local_caller, so this request must not carry one.
    assert!(
        !request.to_lowercase().contains("\norigin:"),
        "an Origin header was sent, which the node refuses:\n{request}"
    );

    // The Host must be the loopback authority, since the boundary requires a
    // loopback host whose port matches the server's.
    assert!(
        request.to_lowercase().contains("host: 127.0.0.1:"),
        "the Host header was not loopback:\n{request}"
    );
}

#[test]
fn an_unreachable_node_is_reported_rather_than_panicking() {
    // Port 1 on loopback has nothing listening.
    let transport = LoopbackTransport::with_authority(
        "127.0.0.1:1".into(),
        "Ab3dEf7hIj1lMn5pQr9tUv2xYz4bCd8e".into(),
    );
    match transport.get("/nf-node/health") {
        Err(detail) => assert!(!detail.is_empty()),
        Ok(other) => panic!("expected a transport error, got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// The wire contract with the webview.
//
// The two sides of the bridge are written in different languages with
// different naming conventions, and a disagreement between them is invisible
// at runtime: a key this side renames is simply `undefined` over there, not an
// error. So the shape is declared once in a fixture both sides read, and this
// asserts that what `serde` actually emits equals it.

/// The shared declaration of the wire shape. The path is explicit so the
/// cross-boundary relationship is visible from here.
const LANE_STATE_FIXTURES: &str =
    include_str!("../../../src/lib/core/neuronforge/lane-state.fixtures.json");

fn fixture_state(name: &str) -> serde_json::Value {
    let fixtures: serde_json::Value =
        serde_json::from_str(LANE_STATE_FIXTURES).expect("the fixture file is not valid JSON");
    fixtures
        .get("states")
        .and_then(|states| states.get(name))
        .unwrap_or_else(|| panic!("the fixture file declares no state named {name}"))
        .clone()
}

/// Asserts the serialization of `state` is exactly the fixture named `name`.
fn assert_matches_fixture(name: &str, state: &LaneState) {
    let emitted = serde_json::to_value(state).expect("a lane state failed to serialise");
    assert_eq!(
        emitted,
        fixture_state(name),
        "the Rust wire shape of {name} does not match the shared fixture, so the \
         webview would read a key that is not there"
    );
}

#[test]
fn every_state_serialises_to_the_shared_wire_shape() {
    assert_matches_fixture(
        "ready",
        &LaneState::Ready {
            models: vec!["qwen2.5-coder:7b".into(), "llama3.1:8b".into()],
            resident_models: vec!["qwen2.5-coder:7b".into()],
        },
    );
    assert_matches_fixture(
        "runtime_degraded",
        &LaneState::RuntimeDegraded {
            reason: "ollama is not reachable".into(),
        },
    );
    assert_matches_fixture(
        "refused",
        &LaneState::Refused {
            refusal: Refusal::InvalidLocalCaller,
            status: 403,
        },
    );
    assert_matches_fixture(
        "unreachable",
        &LaneState::Unreachable {
            detail: "connection refused".into(),
        },
    );
    assert_matches_fixture(
        "bridge_unconfigured",
        &LaneState::BridgeUnconfigured {
            reason: "NEURONFORGE_LOCAL_CAPABILITY is not set".into(),
        },
    );
}

// A variant added here and not to the fixture, or vice versa, would otherwise
// pass: the test above only checks the states it names. This fails when the
// two sets stop agreeing.
#[test]
fn the_fixture_declares_exactly_the_states_this_side_produces() {
    let fixtures: serde_json::Value = serde_json::from_str(LANE_STATE_FIXTURES).unwrap();

    let declared: Vec<&str> = fixtures["rust_produced"]
        .as_array()
        .expect("the fixture file must declare rust_produced")
        .iter()
        .map(|name| name.as_str().unwrap())
        .collect();

    // Built by hand rather than derived, so adding a variant to `LaneState`
    // does not silently extend what this test considers complete. The match
    // below is what makes the omission a compile error.
    let produced = [
        "ready",
        "runtime_degraded",
        "refused",
        "unreachable",
        "bridge_unconfigured",
    ];
    for name in &produced {
        let state = match *name {
            "ready" => LaneState::Ready {
                models: vec![],
                resident_models: vec![],
            },
            "runtime_degraded" => LaneState::RuntimeDegraded {
                reason: String::new(),
            },
            "refused" => LaneState::Refused {
                refusal: Refusal::InvalidLocalCaller,
                status: 403,
            },
            "unreachable" => LaneState::Unreachable {
                detail: String::new(),
            },
            "bridge_unconfigured" => LaneState::BridgeUnconfigured {
                reason: String::new(),
            },
            other => panic!("no lane state is mapped for {other}"),
        };
        let tag = serde_json::to_value(&state).unwrap()["kind"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(&tag, name, "a variant's tag drifted from its fixture name");
    }

    assert_eq!(
        declared, produced,
        "the fixture's rust_produced list and this side's variants disagree"
    );
}

// The asymmetry is deliberate and worth pinning: reaching this process at all
// proves a bridge exists, so there is nothing here that could report its
// absence. If a `bridge_absent` ever appears on this side, one of the two
// meanings has been lost.
#[test]
fn this_side_cannot_report_the_bridge_as_absent() {
    let fixtures: serde_json::Value = serde_json::from_str(LANE_STATE_FIXTURES).unwrap();
    let webview_only: Vec<&str> = fixtures["webview_only"]
        .as_array()
        .expect("the fixture file must declare webview_only")
        .iter()
        .map(|name| name.as_str().unwrap())
        .collect();
    assert_eq!(webview_only, ["bridge_absent"]);

    let rust_produced: Vec<&str> = fixtures["rust_produced"]
        .as_array()
        .unwrap()
        .iter()
        .map(|name| name.as_str().unwrap())
        .collect();
    for name in &webview_only {
        assert!(
            !rust_produced.contains(name),
            "{name} is declared webview-only but also listed as produced here"
        );
    }
}
