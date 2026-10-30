//! The library half of the VibeForge desktop host.
//!
//! It exists so this logic can be compiled and tested on its own. `cargo test`
//! builds every target, including the `vibeforge` binary, whose
//! `generate_context!` requires a frontend bundle at `frontendDist` that the
//! configured SvelteKit adapter does not produce. `cargo test --lib` restricts
//! the build to this target and therefore works. See docs/KNOWN_ISSUES.md.

pub mod neuronforge;
