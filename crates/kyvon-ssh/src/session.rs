//! One authenticated SSH session per server, multiplexing every feature.

use std::sync::Arc;
use std::time::Duration;

use kyvon_core::{AuthMethod, KyvonError, Result, ServerProfile};
use kyvon_security::Cmd;
use russh::client::{self, Handle, Msg};
use russh::keys::{PrivateKeyWithHashAlg, PublicKeyOrCertificate};
use russh::{Channel, ChannelMsg, Disconnect};
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, warn};

use crate::hostkey::{PresentedKey, SharedVerifier, Verdict};

/// How long to wait for the TCP connection and key exchange.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Silence after which a keepalive is sent, so a dead NAT mapping is noticed.
const KEEPALIVE: Duration = Duration::from_secs(20);
/// Output cap for a one-off command, so a runaway `cat` cannot exhaust memory.
const MAX_EXEC_OUTPUT: usize = 4 * 1024 * 1024;

/// The result of running one command on a remote host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    /// `None` when the remote process was killed by a signal and reported no
    /// exit status.
    pub exit_status: Option<u32>,
}

impl CommandOutput {
    pub fn success(&self) -> bool {
        self.exit_status == Some(0)
    }

    /// Stdout when the command succeeded; a typed error carrying stderr
    /// otherwise. Used wherever a non-zero status means the caller cannot
    /// proceed.
    pub fn require_success(self) -> Result<String> {
        if self.success() {
            Ok(self.stdout)
        } else {
            Err(KyvonError::RemoteCommand {
                status: self.exit_status.unwrap_or(255),
                stderr: kyvon_core::redact(self.stderr.trim()),
            })
        }
    }
}

/// The `russh` callback surface. Its only real job is to route the host key
/// decision to the application's verifier.
struct ClientHandler {
    host: String,
    port: u16,
    verifier: SharedVerifier,
}

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> std::result::Result<bool, Self::Error> {
        let presented = match PresentedKey::from_russh(server_public_key) {
            Ok(k) => k,
            // A key we cannot even render is a key we cannot ask about.
            Err(e) => {
                warn!("unreadable host key from {}:{}: {e}", self.host, self.port);
                return Ok(false);
            }
        };
        Ok(matches!(
            self.verifier
                .verify(&self.host, self.port, &presented)
                .await,
            Verdict::Trust
        ))
    }
}

/// A live session. Dropping it closes the TCP connection and every channel
/// multiplexed over it.
pub struct SshSession {
    handle: Handle<ClientHandler>,
    profile: ServerProfile,
}

impl SshSession {
    /// Open and authenticate a session.
    ///
    /// The host key is verified before authentication is attempted, so a
    /// password is never offered to a host whose identity has not been
    /// established.
    pub async fn connect(
        profile: &ServerProfile,
        verifier: SharedVerifier,
        secret: Option<String>,
    ) -> Result<Self> {
        profile.validate()?;

        let config = Arc::new(client::Config {
            inactivity_timeout: None,
            keepalive_interval: Some(KEEPALIVE),
            keepalive_max: 3,
            nodelay: true,
            ..Default::default()
        });

        let handler = ClientHandler {
            host: profile.hostname.clone(),
            port: profile.port,
            verifier,
        };

        let addr = (profile.hostname.as_str(), profile.port);
        let connect = client::connect(config, addr, handler);
        let mut handle = match tokio::time::timeout(CONNECT_TIMEOUT, connect).await {
            Err(_) => {
                return Err(KyvonError::ConnectTimeout {
                    host: profile.hostname.clone(),
                    timeout_secs: CONNECT_TIMEOUT.as_secs(),
                })
            }
            Ok(Err(e)) => return Err(map_connect_error(profile, e)),
            Ok(Ok(h)) => h,
        };

        authenticate(&mut handle, profile, secret).await?;

        Ok(Self {
            handle,
            profile: profile.clone(),
        })
    }

    pub fn profile(&self) -> &ServerProfile {
        &self.profile
    }

    /// Whether the transport is still up. Cheap; does not touch the network.
    pub fn is_closed(&self) -> bool {
        self.handle.is_closed()
    }

    /// Run one command and collect its output.
    ///
    /// Takes a [`Cmd`] rather than a string so the command cannot have been
    /// assembled by concatenating operator input.
    pub async fn exec(&self, cmd: &Cmd) -> Result<CommandOutput> {
        self.exec_raw(&cmd.render()).await
    }

    /// Run a command line that this crate constructed itself.
    ///
    /// Not public: everything reaching a remote host from outside `kyvon-ssh`
    /// goes through [`Self::exec`] and therefore through [`Cmd`]'s quoting.
    pub(crate) async fn exec_raw(&self, command: &str) -> Result<CommandOutput> {
        let mut channel = self.open_channel().await?;
        channel
            .exec(true, command)
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))?;

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut exit_status = None;
        let mut truncated = false;

        while let Some(msg) = channel.wait().await {
            match msg {
                ChannelMsg::Data { data } => append_capped(&mut stdout, &data, &mut truncated),
                // ext 1 is stderr; SSH defines no other extended data type.
                ChannelMsg::ExtendedData { data, ext: 1 } => {
                    append_capped(&mut stderr, &data, &mut truncated)
                }
                ChannelMsg::ExitStatus { exit_status: s } => exit_status = Some(s),
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }

        if truncated {
            stdout.extend_from_slice(
                b"\n[output truncated by KyvonOPS at 4 MB; narrow the command or use the log viewer]\n",
            );
        }

        Ok(CommandOutput {
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
            exit_status,
        })
    }

    /// Start a long-running command and stream its stdout line by line.
    ///
    /// Used for the telemetry collector and for followed logs. The returned
    /// [`StreamHandle`] stops the remote process when dropped, so a closed log
    /// panel does not leave a `journalctl -f` running on the server.
    pub async fn stream(&self, command: &str, stdin: Option<&[u8]>) -> Result<StreamHandle> {
        let mut channel = self.open_channel().await?;
        channel
            .exec(true, command)
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))?;

        if let Some(bytes) = stdin {
            channel
                .data(bytes)
                .await
                .map_err(|e| KyvonError::Transport(e.to_string()))?;
            channel
                .eof()
                .await
                .map_err(|e| KyvonError::Transport(e.to_string()))?;
        }

        let (tx, rx) = mpsc::channel::<StreamItem>(256);
        let task = tokio::spawn(async move {
            let mut buffer: Vec<u8> = Vec::with_capacity(8192);
            while let Some(msg) = channel.wait().await {
                match msg {
                    ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                        buffer.extend_from_slice(&data);
                        // Emit whole lines only; a frame split across two TCP
                        // segments must not be parsed as two frames.
                        while let Some(nl) = buffer.iter().position(|b| *b == b'\n') {
                            let line: Vec<u8> = buffer.drain(..=nl).collect();
                            let text = String::from_utf8_lossy(&line)
                                .trim_end_matches(['\n', '\r'])
                                .to_string();
                            if tx.send(StreamItem::Line(text)).await.is_err() {
                                return; // receiver dropped: stop reading
                            }
                        }
                        // A single line longer than 1 MB is not a line.
                        if buffer.len() > 1024 * 1024 {
                            buffer.clear();
                        }
                    }
                    ChannelMsg::ExitStatus { exit_status } => {
                        let _ = tx.send(StreamItem::Exited(Some(exit_status))).await;
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => break,
                    _ => {}
                }
            }
            let _ = tx.send(StreamItem::Exited(None)).await;
        });

        Ok(StreamHandle { rx, task })
    }

    /// Open an interactive shell with a pseudo-terminal.
    ///
    /// This is a real login shell over the same session as everything else;
    /// nothing about the terminal is simulated (specification §34).
    pub async fn open_terminal(&self, cols: u16, rows: u16) -> Result<TerminalHandle> {
        let channel = self.open_channel().await?;
        channel
            .request_pty(true, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))?;
        channel
            .request_shell(true)
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))?;

        let (read, write) = channel.split();
        let (tx, rx) = mpsc::channel::<TerminalItem>(512);

        let task = tokio::spawn(async move {
            let mut read = read;
            while let Some(msg) = read.wait().await {
                match msg {
                    ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                        // Terminal output is bytes, not text: a UTF-8 sequence
                        // can straddle two packets, and escape sequences are
                        // not text at all. It is forwarded unmodified.
                        if tx.send(TerminalItem::Bytes(data.to_vec())).await.is_err() {
                            return;
                        }
                    }
                    ChannelMsg::ExitStatus { exit_status } => {
                        let _ = tx.send(TerminalItem::Exited(Some(exit_status))).await;
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => break,
                    _ => {}
                }
            }
            let _ = tx.send(TerminalItem::Exited(None)).await;
        });

        Ok(TerminalHandle {
            write: Mutex::new(write),
            rx: Mutex::new(rx),
            task,
        })
    }

    /// Open an SFTP subsystem channel over this session.
    pub async fn open_sftp(&self) -> Result<russh_sftp::client::SftpSession> {
        let channel = self.open_channel().await?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| KyvonError::Sftp(e.to_string()))?;
        russh_sftp::client::SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| KyvonError::Sftp(e.to_string()))
    }

    async fn open_channel(&self) -> Result<Channel<Msg>> {
        if self.handle.is_closed() {
            return Err(KyvonError::NotConnected(self.profile.id.clone()));
        }
        self.handle
            .channel_open_session()
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))
    }

    /// Close the session politely so the server records a clean disconnect.
    pub async fn disconnect(&self) {
        let _ = self
            .handle
            .disconnect(
                Disconnect::ByApplication,
                "kyvonops: closed by operator",
                "en",
            )
            .await;
    }
}

fn append_capped(buf: &mut Vec<u8>, data: &[u8], truncated: &mut bool) {
    if buf.len() >= MAX_EXEC_OUTPUT {
        *truncated = true;
        return;
    }
    let room = MAX_EXEC_OUTPUT - buf.len();
    if data.len() > room {
        *truncated = true;
        buf.extend_from_slice(&data[..room]);
    } else {
        buf.extend_from_slice(data);
    }
}

/// One item from a streamed command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamItem {
    Line(String),
    Exited(Option<u32>),
}

/// A running remote command whose output is being read line by line.
pub struct StreamHandle {
    rx: mpsc::Receiver<StreamItem>,
    task: tokio::task::JoinHandle<()>,
}

impl StreamHandle {
    pub async fn next(&mut self) -> Option<StreamItem> {
        self.rx.recv().await
    }
}

impl Drop for StreamHandle {
    fn drop(&mut self) {
        // Aborting the reader closes the channel, which signals the remote
        // process. Without this, closing a log panel would leave
        // `journalctl -f` running on the server indefinitely.
        self.task.abort();
    }
}

/// One item from an interactive terminal.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalItem {
    Bytes(Vec<u8>),
    Exited(Option<u32>),
}

/// A live interactive shell.
pub struct TerminalHandle {
    write: Mutex<russh::ChannelWriteHalf<Msg>>,
    rx: Mutex<mpsc::Receiver<TerminalItem>>,
    task: tokio::task::JoinHandle<()>,
}

impl TerminalHandle {
    /// Send keystrokes to the remote shell.
    pub async fn write(&self, bytes: &[u8]) -> Result<()> {
        self.write
            .lock()
            .await
            .data(bytes)
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))
    }

    /// Tell the remote side the window changed, so `less`, `vim` and friends
    /// redraw at the right size.
    pub async fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.write
            .lock()
            .await
            .window_change(cols as u32, rows as u32, 0, 0)
            .await
            .map_err(|e| KyvonError::Transport(e.to_string()))
    }

    pub async fn next(&self) -> Option<TerminalItem> {
        self.rx.lock().await.recv().await
    }

    pub async fn close(&self) {
        let write = self.write.lock().await;
        let _ = write.eof().await;
        let _ = write.close().await;
    }
}

impl Drop for TerminalHandle {
    fn drop(&mut self) {
        self.task.abort();
    }
}

// ------------------------------------------------------- authentication

async fn authenticate(
    handle: &mut Handle<ClientHandler>,
    profile: &ServerProfile,
    secret: Option<String>,
) -> Result<()> {
    let auth_failed = || KyvonError::AuthFailed {
        host: profile.hostname.clone(),
        username: profile.username.clone(),
        method: profile.auth.label().to_string(),
    };

    let ok = match &profile.auth {
        AuthMethod::Password => {
            let password = secret.ok_or_else(|| {
                KyvonError::Vault(format!(
                    "no password is stored for {} — open the server's connection settings to set one",
                    profile.alias
                ))
            })?;
            handle
                .authenticate_password(&profile.username, password)
                .await
                .map_err(|e| KyvonError::Transport(e.to_string()))?
                .success()
        }
        AuthMethod::PrivateKey { path, .. } => {
            let key = russh::keys::load_secret_key(path, secret.as_deref()).map_err(|e| {
                let msg = e.to_string();
                if msg.contains("passphrase") || msg.contains("decrypt") {
                    KyvonError::Vault(format!(
                        "the key at {path} is encrypted and the stored passphrase did not open it"
                    ))
                } else {
                    KyvonError::Invalid(format!("could not read the private key at {path}: {msg}"))
                }
            })?;
            // Ask the server which RSA signature hash it accepts rather than
            // defaulting to SHA-1, which modern OpenSSH refuses.
            let hash_alg = handle
                .best_supported_rsa_hash()
                .await
                .ok()
                .flatten()
                .flatten();
            handle
                .authenticate_publickey(
                    &profile.username,
                    PrivateKeyWithHashAlg::new(Arc::new(key), hash_alg),
                )
                .await
                .map_err(|e| KyvonError::Transport(e.to_string()))?
                .success()
        }
        AuthMethod::Agent => authenticate_via_agent(handle, profile).await?,
    };

    if ok {
        Ok(())
    } else {
        Err(auth_failed())
    }
}

/// Offer each identity the running ssh-agent holds, in the order the agent
/// lists them, stopping at the first the server accepts.
async fn authenticate_via_agent(
    handle: &mut Handle<ClientHandler>,
    profile: &ServerProfile,
) -> Result<bool> {
    use russh::keys::agent::client::AgentClient;

    // `SSH_AUTH_SOCK` is a Unix convention. Windows runners and Windows
    // users use Pageant instead; keeping the selection here makes the same
    // typed agent-auth path compile for every supported desktop target.
    #[cfg(unix)]
    let mut agent = AgentClient::connect_env()
        .await
        .map_err(|e| {
            KyvonError::Vault(format!(
                "could not reach an ssh-agent (SSH_AUTH_SOCK): {e}. Start one, or configure a key file instead."
            ))
        })?
        .dynamic();

    #[cfg(windows)]
    let mut agent = AgentClient::connect_pageant()
        .await
        .map_err(|e| {
            KyvonError::Vault(format!(
                "could not reach the Windows SSH agent (Pageant): {e}. Start Pageant, or configure a key file instead."
            ))
        })?
        .dynamic();

    #[cfg(not(any(unix, windows)))]
    return Err(KyvonError::Vault(
        "SSH agent authentication is unavailable on this platform; configure a key file instead."
            .into(),
    ));

    let identities = agent
        .request_identities()
        .await
        .map_err(|e| KyvonError::Vault(format!("ssh-agent refused to list identities: {e}")))?;

    if identities.is_empty() {
        return Err(KyvonError::Vault(
            "the ssh-agent is running but holds no identities — add one with `ssh-add`".into(),
        ));
    }

    let hash_alg = handle
        .best_supported_rsa_hash()
        .await
        .ok()
        .flatten()
        .flatten();
    for identity in identities {
        let russh::keys::agent::AgentIdentity::PublicKey { key, comment } = &identity else {
            continue;
        };
        debug!("offering agent identity {comment}");
        // `AgentClient` implements russh's `Signer`, so the private key
        // never leaves the agent — only signatures do.
        match handle
            .authenticate_publickey_with(&profile.username, key.clone(), hash_alg, &mut agent)
            .await
        {
            Ok(result) if result.success() => return Ok(true),
            Ok(_) => continue,
            Err(e) => {
                warn!("agent identity {comment} failed: {e}");
                continue;
            }
        }
    }
    Ok(false)
}

/// Turn a transport failure into an error the operator can act on.
fn map_connect_error(profile: &ServerProfile, e: russh::Error) -> KyvonError {
    match e {
        russh::Error::IO(io) => match io.kind() {
            std::io::ErrorKind::TimedOut => KyvonError::ConnectTimeout {
                host: profile.hostname.clone(),
                timeout_secs: CONNECT_TIMEOUT.as_secs(),
            },
            _ => KyvonError::Unreachable {
                host: profile.hostname.clone(),
                port: profile.port,
                reason: io.to_string(),
            },
        },
        // `russh` reports a rejected host key as a failed key exchange; the
        // operator's actual decision is the useful message here.
        russh::Error::NoAuthMethod | russh::Error::UnknownKey => KyvonError::HostKeyUntrusted {
            host: profile.hostname.clone(),
            fingerprint: String::new(),
        },
        other => KyvonError::Transport(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_zero_exit_becomes_a_typed_error_carrying_stderr() {
        let out = CommandOutput {
            stdout: String::new(),
            stderr: "Unit nope.service could not be found.\n".into(),
            exit_status: Some(4),
        };
        assert!(!out.success());
        match out.require_success() {
            Err(KyvonError::RemoteCommand { status, stderr }) => {
                assert_eq!(status, 4);
                assert!(stderr.contains("could not be found"));
            }
            other => panic!("expected RemoteCommand, got {other:?}"),
        }
    }

    #[test]
    fn stderr_is_redacted_before_it_reaches_an_error() {
        let out = CommandOutput {
            stdout: String::new(),
            stderr: "psql: connection to postgres://app:hunter2@db failed".into(),
            exit_status: Some(2),
        };
        let Err(KyvonError::RemoteCommand { stderr, .. }) = out.require_success() else {
            panic!("expected an error");
        };
        assert!(!stderr.contains("hunter2"), "leaked: {stderr}");
    }

    #[test]
    fn output_is_capped_and_the_truncation_is_visible() {
        let mut buf = Vec::new();
        let mut truncated = false;
        let chunk = vec![b'x'; 1024 * 1024];
        for _ in 0..8 {
            append_capped(&mut buf, &chunk, &mut truncated);
        }
        assert_eq!(buf.len(), MAX_EXEC_OUTPUT);
        assert!(
            truncated,
            "a caller must be able to tell output was dropped"
        );
    }

    #[test]
    fn a_signal_killed_command_is_not_reported_as_success() {
        let out = CommandOutput {
            stdout: "partial".into(),
            stderr: String::new(),
            exit_status: None,
        };
        assert!(!out.success());
    }
}
