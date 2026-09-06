use kyvon_core::mcp::McpRole;
use kyvon_policy::mcp_server::McpProtocolHandler;
use std::io::{self, BufRead, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("[KYVONOPS-MCP] Listening on stdio for Codex Astra / Claude Opus / Agy Gemini 3.8.");

    // No trusted identity or policy provisioning exists yet: default to least privilege.
    let handler = McpProtocolHandler::new(McpRole::Observer);

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line_result in stdin.lock().lines() {
        let line = line_result?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Some(response) = handler.handle_message(trimmed) else {
            continue;
        };
        let response_str = serde_json::to_string(&response)?;

        writeln!(stdout, "{}", response_str)?;
        stdout.flush()?;
    }

    eprintln!("[KYVONOPS-MCP] Server shutting down.");
    Ok(())
}
