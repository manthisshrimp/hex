use std::path::PathBuf;
use tokio::fs;
use sha2::{Sha256, Digest};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::warn;

#[derive(Clone)]
pub struct AuthManager {
    pwd_file: PathBuf,
    admin_hash: Arc<RwLock<Option<String>>>,
}

impl AuthManager {
    pub async fn new() -> Result<Self, anyhow::Error> {
        if let Ok(env_pwd) = std::env::var("ADMIN_PASSWORD") {
            let hash = Self::hash_password(env_pwd.trim());
            return Ok(Self {
                pwd_file: PathBuf::new(),
                admin_hash: Arc::new(RwLock::new(Some(hash))),
            });
        }
        let pwd_file = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
            .join(".habits-admin.pwd");
        Self::new_with_path(pwd_file).await
    }

    pub async fn new_with_path(pwd_file: PathBuf) -> Result<Self, anyhow::Error> {
        let manager = Self {
            pwd_file,
            admin_hash: Arc::new(RwLock::new(None)),
        };
        manager.initialize().await?;
        Ok(manager)
    }

    async fn initialize(&self) -> Result<(), anyhow::Error> {
        if !self.pwd_file.exists() {
            let default_pwd = "changeme123";
            fs::write(&self.pwd_file, default_pwd).await?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&self.pwd_file).await?.permissions();
                perms.set_mode(0o600);
                fs::set_permissions(&self.pwd_file, perms).await?;
            }
            warn!("Created default habits admin password file at {:?}. PLEASE CHANGE IT!", self.pwd_file);
        }
        let pwd = fs::read_to_string(&self.pwd_file).await?;
        let hash = Self::hash_password(pwd.trim());
        *self.admin_hash.write().await = Some(hash);
        Ok(())
    }

    pub fn hash_password(password: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hex::encode(hasher.finalize())
    }

    pub async fn verify_token(&self, token: &str) -> bool {
        if let Some(hash) = self.admin_hash.read().await.as_ref() {
            hash == token
        } else {
            false
        }
    }

    /// Sync variant — uses try_read() to avoid async in handler guards.
    pub fn verify_token_sync(&self, token: &str) -> bool {
        if let Ok(guard) = self.admin_hash.try_read() {
            guard.as_deref() == Some(token)
        } else {
            false
        }
    }

    /// Validates the password against the stored hash.
    /// Returns Some(token) only if the password is correct; None → 403.
    pub fn authenticate(&self, password: &str) -> Option<String> {
        let hash = Self::hash_password(password);
        if self.verify_token_sync(&hash) {
            Some(hash)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_hash_and_verify() {
        let temp = TempDir::new().unwrap();
        let pwd_path = temp.path().join(".habits-admin.pwd");
        std::fs::write(&pwd_path, "secret").unwrap();

        let auth = AuthManager::new_with_path(pwd_path).await.unwrap();
        let hash = AuthManager::hash_password("secret");
        assert!(auth.verify_token(&hash).await);
        assert!(!auth.verify_token("wronghash").await);
    }
}
