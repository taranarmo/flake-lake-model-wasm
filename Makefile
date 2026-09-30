.PHONY: all build site clean serve deps lock

all: build site

deps:
	uv sync

lock:
	uv lock

build:
	./build.sh

site:
	uv run build_site.py

clean:
	rm -rf _site src/*.mod src/*.o src/*.ll

serve: site
	uv run python -m http.server -d _site 8000
