use std::io::{Cursor, Read};

use flate2::read::ZlibDecoder;

use crate::pak::error::{PakError, PakResult};
use crate::pak::format::PakCompression;

pub fn wrap_reader(
    mut reader: Box<dyn Read + Send>,
    compression: PakCompression,
    expected_size: u64,
) -> PakResult<Box<dyn Read + Send>> {
    match compression {
        PakCompression::None => Ok(reader),
        PakCompression::Zlib => Ok(Box::new(ZlibDecoder::new(reader))),
        PakCompression::Lz4 => {
            let output_size = usize::try_from(expected_size).map_err(|_| {
                PakError::size_limit_exceeded("lz4 pak entry output", expected_size, usize::MAX as u64)
            })?;
            let mut compressed = Vec::new();
            reader.read_to_end(&mut compressed)?;
            let decompressed = decompress_lz4_block_bytes(&compressed, output_size, "pak entry")?;
            Ok(Box::new(Cursor::new(decompressed)))
        }
        PakCompression::Zstd => Err(PakError::not_implemented(
            "zstd-compressed pak entry decoding is not implemented yet",
        )),
        PakCompression::Unknown(value) => Err(PakError::decompression(format!(
            "unknown compression method: {}",
            value
        ))),
    }
}

pub fn decompress_lz4_block_bytes(
    compressed: &[u8],
    output_limit: usize,
    context: &'static str,
) -> PakResult<Vec<u8>> {
    lz4_flex::block::decompress(compressed, output_limit).map_err(|err| {
        PakError::decompression(format!("failed to decompress {} as LZ4 block: {}", context, err))
    })
}