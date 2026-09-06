//! Turning what a Linux host reports into typed samples.
//!
//! # Why parsing happens here and not on the remote host
//!
//! The remote collector is deliberately almost inert: it concatenates kernel
//! interfaces (`/proc/stat`, `/proc/meminfo`, …) and a small number of command
//! outputs into framed blocks and writes them to stdout. Every calculation —
//! jiffy deltas into percentages, byte counters into rates, `df` columns into
//! filesystem records — happens in this crate, on the desktop.
//!
//! That split buys three things:
//!
//! * The remote side has no arithmetic to get wrong, and stays small enough to
//!   read in full before trusting it.
//! * All the logic that could produce a *wrong number* is unit-testable
//!   against captured fixtures, which is the only way to honour the
//!   "no fake metrics" rule with any confidence.
//! * A future compiled agent can emit typed frames directly (see
//!   [`protocol`]) without any of this changing shape.

pub mod aggregate;
pub mod collector;
pub mod commands;
pub mod proc;
pub mod protocol;
pub mod sample;
pub mod state;

pub use collector::{Block, Section, COLLECTOR_SCRIPT, COLLECTOR_VERSION};
pub use protocol::{decode_line, encode_frame};
pub use sample::frames_from_block;
pub use state::TelemetryState;
