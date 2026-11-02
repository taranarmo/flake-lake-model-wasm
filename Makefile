.PHONY: all build site clean serve deps lock test

all: build site test

deps:
	uv sync

lock:
	uv lock

build:
	bash ./build.sh

site:
	uv run build_site.py

test:
	node test_flake_wasm.js

clean:
	rm -rf _site result src/*.mod src/*.o src/*.ll

serve: site
	uv run python -m http.server -d _site 8000
