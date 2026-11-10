{
  description = "FLake Lake Model in WebAssembly (compiled via LFortran)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    systems.url = "github:nix-systems/default";
    flake-lake-model = {
      url = "github:taranarmo/flake-lake-model";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, systems, flake-lake-model }:
    let
      eachSystem = nixpkgs.lib.genAttrs (import systems);
    in {
      packages = eachSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pythonEnv = pkgs.python3.withPackages (ps: with ps; [
            jinja2
            mistune
            pyyaml
          ]);

          flake-wasm = pkgs.stdenv.mkDerivation {
            pname = "flake-wasm";
            version = "0.68.0";

            src = "${flake-lake-model}/src";

            nativeBuildInputs = [
              pkgs.lfortran
              pkgs.llvmPackages.llvm
              pkgs.llvmPackages.lld
              pkgs.coreutils
            ];

            buildPhase = ''
              runHook preBuild

              echo "Compiling Fortran 90 modules..."
              for mod in data_parameters.f90 flake_derivedtypes.f90 flake_parameters.f90 \
                         flake_configure.f90 flake_albedo_ref.f90 flake_paramoptic_ref.f90 \
                         flake.f90 SfcFlx.f90; do
                lfortran -c "$mod"
              done

              echo "Generating LLVM IR for flake_interface..."
              lfortran --show-llvm -c src_flake_interface_1D.f90 > flake.ll

              echo "Compiling LLVM IR to WebAssembly object file..."
              llc -march=wasm32 -filetype=obj flake.ll -o flake.o

              echo "Linking WebAssembly binary..."
              wasm-ld --no-entry --export-all --import-undefined flake.o -o flake.wasm

              echo "Generating wasm-base64.js..."
              WASM_B64=$(base64 -w 0 flake.wasm)
              cat << EOF > wasm-base64.js
(typeof window !== "undefined" ? window : globalThis).FLAKE_WASM_BASE64 = "''${WASM_B64}";
EOF
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp flake.wasm wasm-base64.js $out/
              runHook postInstall
            '';
          };

          site = pkgs.stdenv.mkDerivation {
            pname = "flake-lake-model-site";
            version = "0.68.0";

            src = pkgs.lib.cleanSourceWith {
              src = ./.;
              filter = path: type:
                let base = baseNameOf path;
                in !(pkgs.lib.hasPrefix "." base
                    || base == "_site"
                    || base == "dist"
                    || base == "build"
                    || base == "flake-lake-model"
                    || pkgs.lib.hasSuffix ".zip" base);
            };

            nativeBuildInputs = [
              pythonEnv
              pkgs.nodejs
            ];

            buildPhase = ''
              runHook preBuild

              # Copy freshly built WASM artifacts from flake-wasm
              cp ${flake-wasm}/flake.wasm ./flake.wasm
              cp ${flake-wasm}/wasm-base64.js ./wasm-base64.js
              cp ${flake-wasm}/flake.wasm ./model/flake.wasm
              cp ${flake-wasm}/wasm-base64.js ./model/wasm-base64.js

              # Run test suite to verify WASM integrity
              node test_flake_wasm.js

              # Build static website into _site/
              python3 build_site.py

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -r _site/* $out/
              runHook postInstall
            '';
          };
        in {
          default = site;
          site = site;
          wasm = flake-wasm;
        }
      );

      apps = eachSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };
          site = self.packages.${system}.site;
        in {
          default = {
            type = "app";
            program = toString (pkgs.writeShellScript "serve-flake" ''
              echo "Serving FLake Lake Model website on http://localhost:8000 ..."
              exec ${pkgs.python3}/bin/python3 - << 'EOF'
import http.server, socketserver, json

DIRECTORY = "${site}"

class SilentHealthCheckHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path in ("/api/status", "/api/status/", "/api/health"):
            data = json.dumps({"status": "ok", "app": "flake-lake-model"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def log_message(self, format, *args):
        # Silence repetitive health check requests from IDE / external pollers
        if len(args) > 0 and any(h in str(args[0]) for h in ("/api/status", "/api/health")):
            return
        super().log_message(format, *args)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", 8000), SilentHealthCheckHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
EOF
            '');
          };
        }
      );

      devShells = eachSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pythonEnv = pkgs.python3.withPackages (ps: with ps; [
            jinja2
            mistune
            pyyaml
          ]);
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              lfortran
              llvmPackages.lld
              llvmPackages.llvm
              uv
              pythonEnv
              nodejs
            ];

            shellHook = ''
              echo "FLake WASM development shell loaded"
              echo "LFortran version: $(lfortran --version | head -n 1)"
            '';
          };
        }
      );
    };
}
