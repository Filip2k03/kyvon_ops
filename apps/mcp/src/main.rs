use std::io::{self, BufRead, Write};
use kyvon_core::mcp::McpRole;
use kyvon_policy::mcp_server::McpProtocolHandler;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("[KYVONOPS-MCP] Server initialized. Listening on stdio for Cursor CLI / Claude Code / Codex...");

    // Default to Operator role for local developer control
    let handler = McpProtocolHandler::new(McpRole::Operator);

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line_result in stdin.lock().lines() {
        let line = line_result?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = handler.handle_rpc(trimmed);
        let response_str = serde_json::to_string(&response)?;

        writeln!(stdout, "{}", response_str)?;
        stdout.flush()?;
    }

    eprintln!("[KYVONOPS-MCP] Server shutting down.");
    Ok(())
}
