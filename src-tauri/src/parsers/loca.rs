use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const LOCA_SIGNATURE: u32 = 0x4143_4f4c;
const HEADER_SIZE: u64 = 12;
const ENTRY_SIZE: u64 = 70;
const KEY_SIZE: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocaEntry {
    pub key: String,
    pub version: u16,
    pub text: String,
}

pub fn parse_loca_file(path: &Path) -> Result<Vec<LocaEntry>, String> {
    let file = File::open(path)
        .map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;
    parse_loca(file)
}

pub fn parse_loca<R: Read + Seek>(mut reader: R) -> Result<Vec<LocaEntry>, String> {
    let file_len = reader.seek(SeekFrom::End(0))
        .map_err(|e| format!("Failed to inspect loca stream: {}", e))?;
    reader.seek(SeekFrom::Start(0))
        .map_err(|e| format!("Failed to rewind loca stream: {}", e))?;

    if file_len < HEADER_SIZE {
        return Err("Loca file too small to contain a header".into());
    }

    let signature = read_u32(&mut reader)?;
    if signature != LOCA_SIGNATURE {
        return Err(format!(
            "Incorrect signature in localization file: expected {:08X}, got {:08X}",
            LOCA_SIGNATURE, signature
        ));
    }

    let num_entries = read_u32(&mut reader)? as usize;
    let texts_offset = read_u32(&mut reader)? as u64;
    let table_end = HEADER_SIZE + ENTRY_SIZE * num_entries as u64;

    if texts_offset < table_end {
        return Err(format!(
            "Invalid loca text offset {} before entry table end {}",
            texts_offset, table_end
        ));
    }
    if texts_offset > file_len {
        return Err(format!(
            "Invalid loca text offset {} beyond file size {}",
            texts_offset, file_len
        ));
    }
    if table_end > file_len {
        return Err(format!(
            "Invalid loca entry table end {} beyond file size {}",
            table_end, file_len
        ));
    }

    let mut raw_entries = Vec::with_capacity(num_entries);
    for _ in 0..num_entries {
        let mut key_bytes = [0u8; KEY_SIZE];
        reader.read_exact(&mut key_bytes)
            .map_err(|e| format!("Failed to read loca entry key: {}", e))?;
        let version = read_u16(&mut reader)?;
        let length = read_u32(&mut reader)? as usize;
        raw_entries.push((decode_key(&key_bytes)?, version, length));
    }

    reader.seek(SeekFrom::Start(texts_offset))
        .map_err(|e| format!("Failed to seek to loca text section: {}", e))?;

    let mut entries = Vec::with_capacity(num_entries);
    for (key, version, length) in raw_entries {
        let text = read_text(&mut reader, length)?;
        entries.push(LocaEntry { key, version, text });
    }

    if entries.len() != num_entries {
        return Err(format!(
            "LOCA entry count mismatch: header declared {} entries but parsed {} (possible truncation)",
            num_entries, entries.len()
        ));
    }

    Ok(entries)
}

fn decode_key(bytes: &[u8; KEY_SIZE]) -> Result<String, String> {
    let key_len = bytes.iter().position(|b| *b == 0).unwrap_or(KEY_SIZE);
    std::str::from_utf8(&bytes[..key_len])
        .map(|s| s.to_string())
        .map_err(|e| format!("Invalid UTF-8 in loca key: {}", e))
}

fn read_text<R: Read>(reader: &mut R, length: usize) -> Result<String, String> {
    if length == 0 {
        return Ok(String::new());
    }

    let mut buffer = vec![0u8; length];
    reader.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read loca text: {}", e))?;

    if buffer.last() == Some(&0) {
        buffer.pop();
    }

    String::from_utf8(buffer)
        .map_err(|e| format!("Invalid UTF-8 in loca text: {}", e))
}

fn read_u16<R: Read>(reader: &mut R) -> Result<u16, String> {
    let mut buf = [0u8; 2];
    reader.read_exact(&mut buf)
        .map_err(|e| format!("Failed to read u16: {}", e))?;
    Ok(u16::from_le_bytes(buf))
}

fn read_u32<R: Read>(reader: &mut R) -> Result<u32, String> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)
        .map_err(|e| format!("Failed to read u32: {}", e))?;
    Ok(u32::from_le_bytes(buf))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pak::PakReader;
    use std::io::Cursor;
    use std::path::PathBuf;

    #[test]
    fn parses_basic_loca_resource() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&LOCA_SIGNATURE.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&(HEADER_SIZE as u32 + ENTRY_SIZE as u32 * 2).to_le_bytes());

        push_entry(&mut bytes, "h1", 1, 6);
        push_entry(&mut bytes, "h2", 7, 1);
        bytes.extend_from_slice(b"Hello\0");
        bytes.extend_from_slice(b"\0");

        let entries = parse_loca(Cursor::new(bytes)).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0], LocaEntry { key: "h1".into(), version: 1, text: "Hello".into() });
        assert_eq!(entries[1], LocaEntry { key: "h2".into(), version: 7, text: String::new() });
    }

    #[test]
    fn rejects_bad_signature() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&(HEADER_SIZE as u32).to_le_bytes());

        let error = parse_loca(Cursor::new(bytes)).unwrap_err();
        assert!(error.contains("Incorrect signature"));
    }

    #[test]
    fn rejects_invalid_text_offset() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&LOCA_SIGNATURE.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&HEADER_SIZE.to_le_bytes());
        push_entry(&mut bytes, "h1", 1, 1);
        bytes.extend_from_slice(b"\0");

        let error = parse_loca(Cursor::new(bytes)).unwrap_err();
        assert!(error.contains("Invalid loca text offset"));
    }

    #[test]
    #[ignore = "requires workspace-root English.pak copied into the repository"]
    fn streams_real_workspace_loca_entries() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let pak_path = root.join("English.pak");
        assert!(pak_path.exists(), "missing {}", pak_path.display());

        let reader = PakReader::open(&pak_path).unwrap();
        let mut chosen_path = None;
        let mut chosen_entries = None;

        for entry in reader.entries() {
            if entry.is_deleted()
                || !entry.path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("loca"))
            {
                continue;
            }

            let mut pak_entry_reader = reader.open_entry(entry).unwrap();
            let bytes = pak_entry_reader.read_to_end_with_limit(32 * 1024 * 1024).unwrap();
            let entries = parse_loca(Cursor::new(bytes)).unwrap();
            if entries.is_empty() {
                continue;
            }

            chosen_path = Some(entry.path.as_str().to_string());
            chosen_entries = Some(entries);
            break;
        }

        let entry_path = chosen_path.expect("expected at least one non-empty .loca entry in English.pak");
        let entries = chosen_entries.unwrap();

        println!("LOCA_SAMPLE entry_path={} total_entries={}", entry_path, entries.len());
        for (index, entry) in entries.iter().take(12).enumerate() {
            println!(
                "LOCA_ROW {:02} key={} version={} text={}",
                index + 1,
                entry.key,
                entry.version,
                preview_text(&entry.text)
            );
        }

        assert!(!entries.is_empty(), "expected decoded localization entries");
    }

    fn push_entry(bytes: &mut Vec<u8>, key: &str, version: u16, length: u32) {
        let mut key_bytes = [0u8; KEY_SIZE];
        key_bytes[..key.len()].copy_from_slice(key.as_bytes());
        bytes.extend_from_slice(&key_bytes);
        bytes.extend_from_slice(&version.to_le_bytes());
        bytes.extend_from_slice(&length.to_le_bytes());
    }

    fn preview_text(text: &str) -> String {
        const MAX_CHARS: usize = 96;

        let mut preview = text
            .chars()
            .map(|ch| if ch.is_control() { ' ' } else { ch })
            .collect::<String>();
        preview = preview.split_whitespace().collect::<Vec<_>>().join(" ");

        let char_count = preview.chars().count();
        if char_count > MAX_CHARS {
            preview.chars().take(MAX_CHARS).collect::<String>() + "..."
        } else {
            preview
        }
    }

}