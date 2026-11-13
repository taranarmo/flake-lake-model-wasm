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
	node --test tests/*.test.js
	uv run python -m unittest discover -s tests -p "test_*.py" -v

clean:
	rm -rf _site result src/*.mod src/*.o src/*.ll

serve: site
	uv run python scripts/serve.py _site 8000
