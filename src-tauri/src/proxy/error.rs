use serde::Serialize;

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProxyError {
    #[error("{message}")]
    BadRequest { message: String },
    #[error("{message}")]
    Security { message: String },
    #[error("{message}")]
    Network { message: String },
    #[error("{message}")]
    Provider {
        message: String,
        status: Option<u16>,
    },
    #[error("{message}")]
    Parse { message: String },
}

impl ProxyError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest {
            message: message.into(),
        }
    }

    pub fn security(message: impl Into<String>) -> Self {
        Self::Security {
            message: message.into(),
        }
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    pub fn provider(message: impl Into<String>, status: Option<u16>) -> Self {
        Self::Provider {
            message: message.into(),
            status,
        }
    }

    pub fn parse(message: impl Into<String>) -> Self {
        Self::Parse {
            message: message.into(),
        }
    }
}
