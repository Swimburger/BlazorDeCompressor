# November 2026 dependency and platform upgrade

This document records the dependency, runtime, CI, Cloudflare, PWA, and test changes on
`codex/dependency-modernization`. The production deployment remains unchanged until this
branch is explicitly approved and merged or deployed.

## Dependency inventory

| Area | Before | After | Notes |
| --- | --- | --- | --- |
| .NET SDK | Unpinned (the machine-selected SDK could be used) | 10.0.404 in `global.json` | `latestPatch` permits servicing patches within the pinned feature band. |
| ASP.NET Core Blazor WebAssembly | 10.0.2 | 10.0.15 | Latest compatible .NET 10 servicing release. .NET 11 packages are intentionally incompatible with `net10.0`. |
| WebAssembly workload | Not installed by the build | `wasm-tools` installed and verified | Enables runtime relinking and removes the publish warning that optimization was being skipped. |
| ZstdSharp.Port | 0.8.7 | 0.8.8 | Latest stable release. |
| Playwright | 1.58.2 | 1.65.0 | Latest stable release; Chromium 158 is used by the upgraded suite. |
| Node.js / npm | Node 20 in CI, otherwise unpinned | Node 24, npm 11.19.1 metadata | Avoids GitHub Actions' retired Node 20 runtime and keeps local/CI installs reproducible. |
| `cf` | 1.0.0-beta.31 | 1.0.0-beta.31 | Already the newest published Cloudflare CLI beta. |
| Wrangler | 4.162.0 | 4.162.0 | Already the newest stable release. |
| GitHub Actions | checkout/setup-node/setup-dotnet v4, upload-artifact v4 | checkout v7, setup-node v7, setup-dotnet v6, upload-artifact v7 | Current Node 24 action runtimes. |
| GitHub runner | `ubuntu-24.04` / `ubuntu-latest` | `ubuntu-26.04` | Explicit, currently supported runner image. |

Both npm trees report zero known vulnerabilities, and NuGet reports no vulnerable packages.
`npm outdated --all` still shows some optional platform binaries and Cloudflare transitive
packages whose registry `latest` differs from the version ranges selected by current `cf` or
Wrangler. Those are upstream-owned constraints, not direct dependencies; forcing overrides
would make the tested Cloudflare toolchain less reliable. The two current Workerd patch levels
are retained because `cf` and Wrangler request them independently.

## Adopted changes and why

### .NET 10 and Blazor WebAssembly

- Pinned SDK 10.0.404 and runtime packages 10.0.15 so local, CI, and Cloudflare builds select
  the same supported toolchain.
- Made `wasm-tools` a checked build prerequisite and installed it in CI. Release build and
  publish now perform native runtime relinking with Emscripten instead of warning and falling
  back to the larger runtime.
- Enabled full trimming and invariant time-zone data. The application already uses invariant
  globalization and doesn't expose culture- or time-zone-sensitive behavior. The full browser
  suite verifies reflection-sensitive compression paths after trimming.
- Preserved the two lazy-loaded Zstandard assemblies. Non-Zstandard hosts neither request nor
  precache them; the Zstandard host loads and precaches them. Automated tests enforce both
  halves of that contract.

Microsoft's guidance says `wasm-tools` enables runtime relinking and is required for AOT, while
AOT commonly improves CPU speed at the cost of a substantially larger download. See the
[WebAssembly build tools and AOT guide](https://learn.microsoft.com/aspnet/core/blazor/webassembly-build-tools-and-aot?view=aspnetcore-10.0),
[runtime performance guidance](https://learn.microsoft.com/aspnet/core/blazor/performance/webassembly-runtime-performance?view=aspnetcore-10.0),
and [lazy assembly guidance](https://learn.microsoft.com/aspnet/core/blazor/webassembly-lazy-load-assemblies?view=aspnetcore-10.0).
The .NET 10 servicing baseline comes from the
[10.0.15 release notes](https://github.com/dotnet/core/blob/main/release-notes/10.0/10.0.15/10.0.15.md).

### PWA, compression, caching, and security

- Restored integrity-checked service-worker installation requests and explicit `no-cache`
  revalidation. A mismatched publish can now fail installation atomically instead of mixing
  resources from different versions.
- Kept navigation fallback and versioned cache cleanup behavior, while testing a complete
  offline reload.
- Added immutable one-year caching for fingerprinted framework resources, explicit revalidation
  for the service worker and asset manifest, `nosniff`, and a strict-origin referrer policy.
- The published-site test server now serves the generated Brotli or gzip sidecar, matching the
  behavior expected from Workers Static Assets and testing the actual compressed artifacts.

These choices follow Microsoft's [Blazor PWA guidance](https://learn.microsoft.com/aspnet/core/blazor/progressive-web-app?view=aspnetcore-10.0)
and [deployment cache integrity guidance](https://learn.microsoft.com/aspnet/core/blazor/host-and-deploy/webassembly-caching?view=aspnetcore-10.0),
plus Cloudflare's [Static Assets header rules](https://developers.cloudflare.com/workers/static-assets/headers/).

ZstdSharp 0.8.8 also adds flushing support for streams and updates its `System.Memory`
dependency. The app uses one-shot compression, so no code change is required; see the
[official ZstdSharp releases](https://github.com/oleg-st/ZstdSharp/releases).

### Cloudflare

- Preserved the Worker name, SPA fallback, and all five custom domains:
  `gzip`, `brotli`, `deflate`, `zlib`, and `zstd` under `swimburger.net`.
- Enabled Workers observability with complete logs, 1% trace sampling, and query-string
  redaction. This gives useful production diagnostics without copying URL query data into
  telemetry or retaining every trace.
- Kept the typed `cloudflare.config.ts` plus Wrangler build settings. The build now explicitly
  publishes the Blazor app before `cf build`, because `cf` deliberately does not run arbitrary
  package scripts. Deployment consumes the already-validated build with `cf deploy --prebuilt`.
- Updated the compatibility date and verified the generated Workers Build Output locally.

Relevant primary references are the [`cf` project build model](https://developers.cloudflare.com/cf/projects/),
[Wrangler-to-`cf` configuration mapping](https://developers.cloudflare.com/cf/wrangler/reference/),
[Workers observability traces](https://developers.cloudflare.com/workers/observability/traces/),
and [Workers production practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

### CI, Playwright, and npm

- Moved the CI and legacy Azure Static Web Apps workflows to Ubuntu 26.04 and Node 24-capable
  action majors. GitHub retired Node 20 action execution, so upgrading only the job's Node
  installation would not have addressed the deprecation warnings.
- Configured Git's intended `main` default for checkout's temporary repository, removing the
  Git 3.0 default-branch migration warning instead of hiding it.
- `setup-dotnet` reads `global.json` and installs `wasm-tools`. CI separately cleans, restores,
  builds, publishes with optimization, validates Cloudflare Build Output, and runs development,
  published-PWA, and live-production suites.
- Playwright now uses its concise failure reporter in CI, retains traces on failure, and always
  generates separate HTML reports below `e2e/playwright-report`. Artifact upload fails if that
  directory is unexpectedly absent, fixing the previous missing-artifact warning instead of
  suppressing it.
- npm 11 strict install-script approval is enabled. Only the pinned scripts required by
  Esbuild, FSEvents, and the two Workerd versions are approved; unreviewed future lifecycle
  scripts fail installation.
- Removed the Azure action's GitHub token because it was only used for automated PR comments.
  Deployment behavior remains otherwise unchanged, and no workflow may communicate on the
  user's behalf through that token.

Primary references: [GitHub's Node 20 retirement notice](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/),
[Ubuntu 26.04 availability](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/),
[checkout releases](https://github.com/actions/checkout/releases),
[setup-node releases](https://github.com/actions/setup-node/releases),
[setup-dotnet releases](https://github.com/actions/setup-dotnet/releases),
[upload-artifact releases](https://github.com/actions/upload-artifact/releases),
[Playwright 1.65 release notes](https://github.com/microsoft/playwright/releases/tag/v1.65.0),
and [npm install-script controls](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/).

## Opportunities intentionally not adopted

- **WebAssembly AOT:** not enabled. This application is download- and startup-sensitive, and
  the current interpreter/Jiterpreter plus SIMD runtime already performs the short compression
  tasks well. AOT often makes the download materially larger. It should be reconsidered only
  with representative large-file CPU benchmarks and a payload budget.
- **WebAssembly multithreading:** not enabled. It remains a higher-risk change and requires
  cross-origin isolation headers that can conflict with Zaraz, Web Analytics, EthicalAds, and
  other cross-origin resources. It needs a separate compatibility and performance project.
- **Cloudflare Static Assets `basePath`:** useful for mounting an app below a URL prefix, but all
  five sites intentionally serve at `/`, so adopting it would change routing without benefit.
- **A custom cache Worker:** unnecessary for fingerprinted framework assets. Static Assets plus
  `_headers` provides the desired immutable and revalidation policies with less code and fewer
  cache-key risks.
- **A strict Content Security Policy:** valuable, but not low risk while third-party analytics
  and advertising scripts are present. It should begin in report-only mode with a deliberate
  nonce/hash and vendor inventory.
- **Immediate service-worker activation (`skipWaiting`):** not adopted because it can mix the
  old page with a newly activated cache. The versioned, atomic next-visit update remains safer.
- **ZstdSharp streaming flush:** the new API is useful for long-lived streaming compressors;
  this app processes complete browser files and doesn't need it.

## Performance measurement

Three clean Chromium contexts loaded the current production Gzip site and the locally published
branch with service workers blocked for a comparable initial network load. The local server used
the generated Brotli sidecars. Values below are medians:

| Measurement | Current production | Optimized branch | Change |
| --- | ---: | ---: | ---: |
| Framework encoded bytes | 2,733,406 | 1,522,838 | -44.3% |
| Total encoded bytes | 2,774,870 | 1,559,416 | -43.8% |
| Framework decoded bytes | 6,798,152 | 4,684,889 | -31.1% |
| Total decoded bytes | 7,054,452 | 4,933,010 | -30.1% |

The total comparison includes production analytics requests that the local host cannot reproduce,
so framework bytes are the most useful figure. Wall-clock time is intentionally omitted: comparing
a remote production edge to localhost would not be meaningful. These gains are not yet live.

## Verification and warnings

The final branch verification covers:

1. clean .NET restore and Release build;
2. trimmed, relinked Release publish;
3. Cloudflare project build;
4. 35 development Playwright tests;
5. live compression/decompression round trips for all five production formats;
6. offline installation and reload;
7. cache headers, lazy loading, Zaraz, and Web Analytics;
8. pushed-branch GitHub CI.

The .NET build has zero warnings and zero errors. Publish prints the expected informational notice
that trimming can change behavior; the full published and browser suites are the required response
to that notice, so it is not suppressed. Playwright reports a local-only warning when Codex's
`NO_COLOR` environment variable meets Playwright's worker-level `FORCE_COLOR`; this does not occur
in the standard GitHub runner environment and does not affect application behavior. No dependency,
security, missing-workload, missing-report, or Node 20 warnings remain.
