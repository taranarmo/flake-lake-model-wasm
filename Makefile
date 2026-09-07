.PHONY: all build clean serve

all: build

build:
	./build.sh

clean:
	rm -f src/*.mod src/*.o src/*.ll flake.wasm wasm-base64.js

serve:
	python3 -m http.server 8000
