#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/src"

echo "=== Building FLake WebAssembly binary ==="

# Check for required tools
command -v lfortran >/dev/null 2>&1 || { echo "Error: lfortran is not installed or not in PATH"; exit 1; }
command -v llc >/dev/null 2>&1 || { echo "Error: llc (LLVM compiler) is not installed or not in PATH"; exit 1; }
command -v wasm-ld >/dev/null 2>&1 || { echo "Error: wasm-ld (LLVM WebAssembly linker) is not installed or not in PATH"; exit 1; }

cd "${SRC_DIR}"

echo "Step 1: Compiling Fortran 90 modules..."
for mod in data_parameters.f90 flake_derivedtypes.f90 flake_parameters.f90 flake_configure.f90 flake_albedo_ref.f90 flake_paramoptic_ref.f90 flake.f90 SfcFlx.f90; do
  echo "  -> Compiling ${mod}"
  lfortran -c "${mod}"
done

echo "Step 2: Generating LLVM IR for flake_interface..."
lfortran --show-llvm -c src_flake_interface_1D.f90 > flake.ll

echo "Step 3: Compiling LLVM IR to WebAssembly object file..."
llc -march=wasm32 -filetype=obj flake.ll -o flake.o

echo "Step 4: Linking WebAssembly binary..."
wasm-ld --no-entry --export-all --import-undefined flake.o -o "${SCRIPT_DIR}/flake.wasm"

echo "Step 5: Cleaning up build intermediates..."
rm -f *.mod *.o flake.ll

echo "Step 6: Generating wasm-base64.js fallback..."
WASM_B64=$(base64 -w 0 "${SCRIPT_DIR}/flake.wasm" 2>/dev/null || base64 "${SCRIPT_DIR}/flake.wasm" | tr -d '\n')
cat << JS_EOF > "${SCRIPT_DIR}/wasm-base64.js"
(typeof window !== "undefined" ? window : globalThis).FLAKE_WASM_BASE64 = "${WASM_B64}";
JS_EOF

echo "=== Build completed successfully! ==="
ls -lh "${SCRIPT_DIR}/flake.wasm" "${SCRIPT_DIR}/wasm-base64.js"
