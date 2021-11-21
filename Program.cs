using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using BlazorDownloadFile;
using BlazorDeCompressor;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.Services.AddBlazorDownloadFile(ServiceLifetime.Scoped);
await builder.Build().RunAsync();
