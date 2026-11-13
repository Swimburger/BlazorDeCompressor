#!/bin/sh
set -eu

if command -v dotnet >/dev/null 2>&1; then
  dotnet_command="dotnet"
else
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o .dotnet-install.sh
  chmod +x .dotnet-install.sh
  ./.dotnet-install.sh --channel 10.0 --install-dir ./.dotnet
  dotnet_command="./.dotnet/dotnet"
fi

rm -rf ./dist
"$dotnet_command" publish BlazorDeCompressor.csproj -c Release -o dist
