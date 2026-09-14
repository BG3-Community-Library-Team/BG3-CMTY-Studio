//! Minimal parser for Valve's KeyValues text format (`.vdf` / `.acf`).
//!
//! Covers what Steam's library metadata uses: quoted and bare tokens, nested
//! `{}` blocks, `\\` / `\"` escapes, `//` comments and `[$PLATFORM]`
//! conditionals (which are skipped).

#[derive(Debug, Clone, PartialEq)]
pub enum VdfValue {
    Str(String),
    Obj(VdfObject),
}

impl VdfValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Str(s) => Some(s),
            Self::Obj(_) => None,
        }
    }

    pub fn as_obj(&self) -> Option<&VdfObject> {
        match self {
            Self::Obj(o) => Some(o),
            Self::Str(_) => None,
        }
    }
}

/// Ordered key/value pairs. Keys are matched case-insensitively, as Steam does.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct VdfObject {
    entries: Vec<(String, VdfValue)>,
}

impl VdfObject {
    pub fn get(&self, key: &str) -> Option<&VdfValue> {
        self.entries
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .map(|(_, v)| v)
    }

    pub fn get_str(&self, key: &str) -> Option<&str> {
        self.get(key)?.as_str()
    }

    pub fn get_obj(&self, key: &str) -> Option<&VdfObject> {
        self.get(key)?.as_obj()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&str, &VdfValue)> {
        self.entries.iter().map(|(k, v)| (k.as_str(), v))
    }
}

#[derive(Debug, PartialEq)]
enum Token {
    Str(String),
    Open,
    Close,
}

/// Parse a KeyValues document into its top-level object.
pub fn parse(input: &str) -> Result<VdfObject, String> {
    let mut tokens = tokenize(input)?.into_iter();
    parse_object(&mut tokens, true)
}

fn parse_object(
    tokens: &mut impl Iterator<Item = Token>,
    top_level: bool,
) -> Result<VdfObject, String> {
    let mut obj = VdfObject::default();
    loop {
        match tokens.next() {
            None if top_level => return Ok(obj),
            None => return Err("unexpected end of input: missing '}'".into()),
            Some(Token::Close) if !top_level => return Ok(obj),
            Some(Token::Close) => return Err("unexpected '}'".into()),
            Some(Token::Open) => return Err("expected a key, found '{'".into()),
            Some(Token::Str(key)) => {
                let value = match tokens.next() {
                    Some(Token::Str(s)) => VdfValue::Str(s),
                    Some(Token::Open) => VdfValue::Obj(parse_object(tokens, false)?),
                    Some(Token::Close) | None => {
                        return Err(format!("missing value for key '{key}'"))
                    }
                };
                obj.entries.push((key, value));
            }
        }
    }
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();

    while let Some(&c) = chars.peek() {
        match c {
            c if c.is_whitespace() => {
                chars.next();
            }
            '{' => {
                chars.next();
                tokens.push(Token::Open);
            }
            '}' => {
                chars.next();
                tokens.push(Token::Close);
            }
            '"' => {
                chars.next();
                tokens.push(Token::Str(read_quoted(&mut chars)?));
            }
            '/' if chars.clone().nth(1) == Some('/') => {
                for ch in chars.by_ref() {
                    if ch == '\n' {
                        break;
                    }
                }
            }
            '[' => {
                // Platform conditional such as `[$WIN32]`; not relevant here.
                for ch in chars.by_ref() {
                    if ch == ']' {
                        break;
                    }
                }
            }
            _ => {
                let mut s = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_whitespace() || matches!(ch, '{' | '}' | '"') {
                        break;
                    }
                    s.push(ch);
                    chars.next();
                }
                tokens.push(Token::Str(s));
            }
        }
    }

    Ok(tokens)
}

/// Read a quoted string; the opening quote has already been consumed.
fn read_quoted(chars: &mut impl Iterator<Item = char>) -> Result<String, String> {
    let mut s = String::new();
    loop {
        match chars.next() {
            None => return Err("unterminated quoted string".into()),
            Some('"') => return Ok(s),
            Some('\\') => match chars.next() {
                Some('n') => s.push('\n'),
                Some('t') => s.push('\t'),
                Some(e @ ('\\' | '"')) => s.push(e),
                Some(other) => {
                    s.push('\\');
                    s.push(other);
                }
                None => return Err("unterminated quoted string".into()),
            },
            Some(ch) => s.push(ch),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIBRARY_FOLDERS: &str = r#"
"libraryfolders"
{
	"0"
	{
		"path"		"/home/user/.local/share/Steam"
		"label"		""
		"apps"
		{
			"228980"		"123"
		}
	}
	"1"
	{
		"path"		"/mnt/games/SteamLibrary"
		"apps"
		{
			"1086940"		"150000000000"
		}
	}
}
"#;

    #[test]
    fn parses_library_folders() {
        let doc = parse(LIBRARY_FOLDERS).unwrap();
        let folders = doc.get_obj("libraryfolders").unwrap();
        let libs: Vec<(&str, bool)> = folders
            .iter()
            .filter_map(|(_, v)| v.as_obj())
            .map(|lib| {
                (
                    lib.get_str("path").unwrap(),
                    lib.get_obj("apps").is_some_and(|apps| apps.get("1086940").is_some()),
                )
            })
            .collect();
        assert_eq!(
            libs,
            vec![
                ("/home/user/.local/share/Steam", false),
                ("/mnt/games/SteamLibrary", true),
            ]
        );
        assert_eq!(folders.get_obj("0").unwrap().get_str("label"), Some(""));
    }

    #[test]
    fn handles_escapes_comments_bare_tokens_and_conditionals() {
        let doc = parse(
            r#"// leading comment
"path"  "C:\\Program Files\\Steam"
"quote" "say \"hi\""
"nested" { bare value } [$WIN32]
"#,
        )
        .unwrap();
        assert_eq!(doc.get_str("path"), Some(r"C:\Program Files\Steam"));
        assert_eq!(doc.get_str("quote"), Some(r#"say "hi""#));
        assert_eq!(doc.get_obj("nested").unwrap().get_str("bare"), Some("value"));
    }

    #[test]
    fn keys_are_case_insensitive() {
        let doc = parse(r#""AppState" { "installdir" "Baldurs Gate 3" }"#).unwrap();
        assert_eq!(
            doc.get_obj("appstate").unwrap().get_str("InstallDir"),
            Some("Baldurs Gate 3")
        );
    }

    #[test]
    fn missing_apps_block_is_not_an_error() {
        let doc = parse(r#""libraryfolders" { "0" { "path" "/lib" } }"#).unwrap();
        let lib = doc.get_obj("libraryfolders").unwrap().get_obj("0").unwrap();
        assert!(lib.get_obj("apps").is_none());
    }

    #[test]
    fn rejects_malformed_input() {
        assert!(parse(r#""a" {"#).is_err());
        assert!(parse("}").is_err());
        assert!(parse(r#""a""#).is_err());
        assert!(parse(r#""a" "unterminated"#).is_err());
    }
}
