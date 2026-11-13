using System.IO;

namespace BlazorDeCompressor.Zstd;

public static class ZstdStreamFactory
{
    public static Stream CreateCompressionStream(Stream output, int level) =>
        new ZstdSharp.CompressionStream(output, level);

    public static Stream CreateDecompressionStream(Stream input) =>
        new ZstdSharp.DecompressionStream(input);
}
