//! Mod resolution: URL/ID → Nexus mod details.

use serde::Serialize;

use crate::platform::errors::PlatformError;

use super::client::NexusClient;

/// Default game domain when none is provided in the URL.
const DEFAULT_GAME_DOMAIN: &str = "baldursgate3";

/// Details of a resolved Nexus mod.
#[derive(Debug, Clone, Serialize)]
pub struct NexusModDetails {
    /// Internal UUID of the mod on Nexus.
    pub id: String,
    /// Game-scoped numeric mod ID (the number in the URL).
    pub game_scoped_id: u64,
    /// Human-readable mod name.
    pub name: String,
}

/// Parse a user-provided URL or bare ID into `(game_domain, game_scoped_id)`.
///
/// Accepted formats:
/// - `https://www.nexusmods.com/baldursgate3/mods/1933?tab=files`
/// - `baldursgate3/mods/1933`
/// - `1933`
fn parse_mod_input(url_or_id: &str) -> Result<(String, u64), PlatformError> {
    let input = url_or_id.trim().trim_end_matches('/');

    // Try bare numeric ID first.
    if let Ok(id) = input.parse::<u64>() {
        return Ok((DEFAULT_GAME_DOMAIN.to_string(), id));
    }

    // Strip URL scheme + host if present.
    let path = if let Some(rest) = input
        .strip_prefix("https://www.nexusmods.com/")
        .or_else(|| input.strip_prefix("https://nexusmods.com/"))
        .or_else(|| input.strip_prefix("http://www.nexusmods.com/"))
        .or_else(|| input.strip_prefix("http://nexusmods.com/"))
    {
        rest
    } else {
        input
    };

    // Strip query params.
    let path = path.split('?').next().unwrap_or(path);
    let path = path.trim_end_matches('/');

    // Expected: `{game_domain}/mods/{id}`
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 3 && parts[1].eq_ignore_ascii_case("mods") {
        let domain = parts[0].to_string();
        let id = parts[2].parse::<u64>().map_err(|_| {
            PlatformError::ValidationError(format!(
                "Cannot parse mod ID from '{}' — expected a number",
                parts[2]
            ))
        })?;
        return Ok((domain, id));
    }

    Err(PlatformError::ValidationError(format!(
        "Unrecognized mod URL or ID: '{url_or_id}'. \
         Expected a Nexus URL (https://www.nexusmods.com/baldursgate3/mods/1933), \
         a partial path (baldursgate3/mods/1933), or a bare numeric ID (1933)."
    )))
}

/// Resolve a Nexus mod by URL or numeric ID.
///
/// Makes a `GET /games/{domain}/mods/{id}` API call and returns
/// the mod's UUID, scoped ID, and name.
pub async fn resolve_mod(
    client: &NexusClient,
    url_or_id: &str,
) -> Result<NexusModDetails, PlatformError> {
    let (domain, scoped_id) = parse_mod_input(url_or_id)?;

    let path = format!("/games/{domain}/mods/{scoped_id}");
    let resp = client.get(&path).await?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Failed to parse mod response: {e}")))?;

    let id = json["id"]
        .as_str()
        .or_else(|| json["uuid"].as_str())
        .or_else(|| json["uid"].as_str())
        .ok_or_else(|| {
            PlatformError::ApiError {
                status: 200,
                message: "Response missing mod UUID field".into(),
            }
        })?
        .to_string();

    let name = json["name"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    Ok(NexusModDetails {
        id,
        game_scoped_id: scoped_id,
        name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bare_id() {
        let (domain, id) = parse_mod_input("1933").unwrap();
        assert_eq!(domain, "baldursgate3");
        assert_eq!(id, 1933);
    }

    #[test]
    fn parse_full_url() {
        let (domain, id) =
            parse_mod_input("https://www.nexusmods.com/baldursgate3/mods/1933?tab=files").unwrap();
        assert_eq!(domain, "baldursgate3");
        assert_eq!(id, 1933);
    }

    #[test]
    fn parse_partial_path() {
        let (domain, id) = parse_mod_input("baldursgate3/mods/1933").unwrap();
        assert_eq!(domain, "baldursgate3");
        assert_eq!(id, 1933);
    }

    #[test]
    fn parse_trailing_slash() {
        let (domain, id) =
            parse_mod_input("https://www.nexusmods.com/baldursgate3/mods/1933/").unwrap();
        assert_eq!(domain, "baldursgate3");
        assert_eq!(id, 1933);
    }

    #[test]
    fn parse_garbage_fails() {
        assert!(parse_mod_input("not-a-url-at-all").is_err());
    }
}
