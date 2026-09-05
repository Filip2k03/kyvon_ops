//! The SSH transport KyvonOPS is built on.
//!
//! Everything that reaches a remote host passes through this crate: telemetry,
//! terminals, file transfers and one-off commands all multiplex over a single
//! authenticated session per server, so connecting to eight servers opens
//! eight TCP connections rather than eight per feature (specification §52).
//!
//! Two properties are structural rather than conventional:
//!
//! * **Host keys are always verified.** [`HostKeyVerifier`] is a required
//!   constructor argument, and the `russh` handler has no path that returns
//!   "trusted" without asking it. There is no configuration flag that turns
//!   this off.
//! * **Commands are values, not strings.** [`session::SshSession::exec`] takes
//!   a [`kyvon_security::Cmd`], which can only be built from a fixed program
//!   and separately quoted arguments.

pub mod discovery;
pub mod hostkey;
pub mod session;
pub mod sftp;
pub mod vault;

pub use hostkey::{HostKeyVerifier, PresentedKey, Verdict};
pub use session::{CommandOutput, SshSession, TerminalHandle};
pub use vault::Vault;
