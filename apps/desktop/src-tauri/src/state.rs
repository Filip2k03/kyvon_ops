use std::sync::Arc;
use tokio::sync::Mutex;
use kyvon_storage::db::Database;
use std::collections::HashMap;
use kyvon_ssh::session::Session;

pub struct SessionManager {
    sessions: HashMap<String, Arc<Mutex<Session>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

pub struct AppState {
    pub db: Arc<Database>,
    pub manager: Arc<Mutex<SessionManager>>,
}
