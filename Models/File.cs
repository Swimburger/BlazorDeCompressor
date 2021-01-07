using Microsoft.AspNetCore.Components.Forms;

namespace BlazorDeCompressor.Models
{
    public class File
    {
        public IBrowserFile BrowserFile { get; set; }
        public string OriginalName { get; set; }
        public string NewName { get; set; }
        public string Status { get; set; }
    }
}
