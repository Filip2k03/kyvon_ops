//! The safety boundary between an operator's intent and a remote system.
//!
//! Three concerns live here, all of which run in Rust and none of which the
//! frontend can skip (specification §96):
//!
//! * [`shell`] — turning values into shell words that cannot break out of
//!   their quoting, so remote commands are built by construction rather than
//!   by string concatenation.
//! * [`path`] — validating remote paths before a filesystem operation names
//!   them.
//! * [`risk`] — classifying what a command would actually do, so the
//!   confirmation the operator sees describes the real blast radius.

pub mod path;
pub mod risk;
pub mod shell;

pub use path::{validate_remote_path, PathClass};
pub use risk::classify;
pub use shell::{quote, Cmd};
