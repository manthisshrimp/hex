// calendar-site/backend-rust/src/auth.rs
use std::path::PathBuf;
use tokio::fs;
use sha2::{Sha256, Digest};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::warn;

#[derive(Clone)]
pub struct AuthManager {
    admin_hash: Arc<RwLock<String>>,
}

impl AuthManager {
    pub async fn new() -> Result<Self, anyhow::Error> {
        if let Ok(env_pwd) = std::env::var("ADMIN_PASSWORD") {
            let hash = Self::hash(env_pwd.trim());
            return Ok(Self { admin_hash: Arc::new(RwLock::new(hash)) });
        }
        let pwd_file = Self::pwd_path();
        if !pwd_file.exists() {
            let default = "changeme123";
            fs::write(&pwd_file, default).await?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&pwd_file).await?.permissions();
                perms.set_mode(0o600);
                fs::set_permissions(&pwd_file, perms).await?;
            }
            warn!("Created default admin password at ~/.calendar-admin.pwd — PLEASE CHANGE IT!");
        }
        let pwd = fs::read_to_string(&pwd_file).await?;
        let hash = Self::hash(pwd.trim());
        Ok(Self { admin_hash: Arc::new(RwLock::new(hash)) })
    }

    fn pwd_path() -> PathBuf {
        dirs::home_dir()
            .expect("home dir must be available")
            .join(".calendar-admin.pwd")
    }

    pub fn hash(password: &str) -> String {
        let mut h = Sha256::new();
        h.update(password.as_bytes());
        hex::encode(h.finalize())
    }

    pub async fn verify(&self, token: &str) -> bool {
        *self.admin_hash.read().await == token
    }
}
