using Microsoft.AspNetCore.Components.Forms;

namespace BlazorDeCompressor.Models
{
    public class File
    {
        public required IBrowserFile BrowserFile { get; set; }
        public required string OriginalName { get; set; }
        public string? NewName { get; set; }
        public required string Status { get; set; }
        public long OriginalSize { get; set; }
        public long OutputSize { get; set; }
    }
}
