#!/bin/sh
# Run from the Web repository; reads the adjacent iOS project without modifying it.
set -eu
web_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ios_root=${1:-"$web_root/../FormulaWorldIOS"}
export_tmp=$(mktemp -d)
trap 'rm -rf "$export_tmp"' EXIT
swiftc -module-cache-path "$export_tmp/cache" "$ios_root"/Core/*.swift "$web_root/tools/export-ios-circuits.swift" -o "$export_tmp/export"
"$export_tmp/export" "$ios_root/Resources/Circuits" "$web_root/src/nativeCircuits"
python3 "$web_root/tools/compact-ios-circuits.py"
