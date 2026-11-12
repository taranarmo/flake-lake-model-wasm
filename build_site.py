#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "jinja2>=3.0.0",
#     "mistune>=3.0.0",
#     "pyyaml>=6.0",
# ]
# ///
"""
FLake Website Static Site Generator
Builds modern, maintainable static HTML pages from Markdown content for GitHub Pages deployment.
All pages and documentation are authored in Markdown (content/*.md).
Build output is generated into _site/ for clean separation between source and build artifacts.
"""

import os
import re
import json
import shutil
import struct
import unicodedata
import yaml
import mistune
from jinja2 import Environment, FileSystemLoader

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(SCRIPT_DIR, "content")
SITE_DATA_DIR = os.path.join(SCRIPT_DIR, "site_data")
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, "templates")
ASSETS_DIR = os.path.join(SCRIPT_DIR, "assets")
MODEL_DIR = os.path.join(SCRIPT_DIR, "model")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "_site")

def load_json(filename):
    path = os.path.join(SITE_DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def parse_markdown_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    frontmatter = {}
    markdown_body = content

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = yaml.safe_load(parts[1]) or {}
            markdown_body = parts[2]

    return frontmatter, markdown_body

def ensure_favicon():
    """Ensure a valid binary favicon.ico exists in _site/ and _site/model/ to avoid browser 404s."""
    site_favicon = os.path.join(OUTPUT_DIR, "favicon.ico")
    site_model_dir = os.path.join(OUTPUT_DIR, "model")
    site_model_favicon = os.path.join(site_model_dir, "favicon.ico")

    root_favicon = os.path.join(SCRIPT_DIR, "favicon.ico")
    if os.path.exists(root_favicon):
        shutil.copy2(root_favicon, site_favicon)
    else:
        # 16x16 32-bit BMP ICO generator
        bmp_size = 40 + 16 * 16 * 4 + 16 * 4
        ico_dir = struct.pack("<HHH", 0, 1, 1)
        ico_entry = struct.pack("<BBBBHHII", 16, 16, 0, 0, 1, 32, bmp_size, 22)
        bmp_header = struct.pack("<IIIHHIIIIII", 40, 16, 32, 1, 32, 0, 16 * 16 * 4, 0, 0, 0, 0)
        pixel = bytes([0x5c, 0x48, 0x0a, 0xff]) # Lake navy #0a485c in BGRA
        pixels = pixel * (16 * 16)
        and_mask = bytes([0] * (16 * 4)) # 16 rows * 4 bytes padded
        ico_data = ico_dir + ico_entry + bmp_header + pixels + and_mask
        with open(site_favicon, "wb") as f:
            f.write(ico_data)

    os.makedirs(site_model_dir, exist_ok=True)
    shutil.copy2(site_favicon, site_model_favicon)

def slugify(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "and").replace("&", "and")
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = text.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    text = re.sub(r"[-\s_]+", "-", text)
    return text

class CustomHTMLRenderer(mistune.HTMLRenderer):
    def heading(self, text, level, **attrs):
        custom_id = None
        m = re.search(r"\s*\{#([a-zA-Z0-9_-]+)\}\s*$", text)
        if m:
            custom_id = m.group(1)
            text = text[:m.start()].strip()

        slug = slugify(text)
        primary_id = custom_id or slug

        alias_html = ""
        if custom_id and slug != custom_id:
            alias_html = f"<span id=\"{slug}\"></span>"

        return f"{alias_html}<h{level} id=\"{primary_id}\">{text}</h{level}>\n"

def main():
    print("=== Building FLake Website into _site/ ===")

    # 1. Clean and initialize _site/ output directory
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 2. Setup Jinja2 Environment
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=True
    )

    # 3. Setup Mistune Markdown Parser with custom renderer, tables & URL autolinking
    md_parser = mistune.create_markdown(
        renderer=CustomHTMLRenderer(escape=False),
        plugins=['table', 'url']
    )

    # 4. Load Global Site Data
    news_data = load_json("news.json")

    # 5. Process all Markdown files in content/
    if not os.path.exists(CONTENT_DIR):
        raise FileNotFoundError(f"Content directory not found: {CONTENT_DIR}")

    md_files = sorted([f for f in os.listdir(CONTENT_DIR) if f.endswith(".md")])
    print(f"Found {len(md_files)} markdown content files to process:")

    for md_filename in md_files:
        md_path = os.path.join(CONTENT_DIR, md_filename)
        base_name = os.path.splitext(md_filename)[0]
        meta, body = parse_markdown_file(md_path)

        out_name = meta.get("output", f"{base_name}.html")
        template_name = meta.get("template", "page.html")

        # Convert markdown body to HTML
        rendered_html = md_parser(body)

        # Context for Jinja2 template
        context = {
            "base_url": "",
            "title": meta.get("title", f"{base_name.replace('-', ' ').title()} - FLake"),
            "page_title": meta.get("page_title", meta.get("title", base_name.replace('-', ' ').title())),
            "page_subtitle": meta.get("page_subtitle", ""),
            "active_page": meta.get("active_page", base_name),
            "description": meta.get("description", ""),
            "breadcrumbs": meta.get("breadcrumbs", []),
            "has_sidebar": meta.get("has_sidebar", True),
            "is_home": meta.get("is_home", False),
            "hero_badge": meta.get("hero_badge", None),
            "show_hero_actions": meta.get("show_hero_actions", False),
            "show_wasm_callout": meta.get("show_wasm_callout", False),
            "filter_search": meta.get("filter_search", False),
            "filter_id": meta.get("filter_id", None),
            "filter_placeholder": meta.get("filter_placeholder", None),
            "filter_count_id": meta.get("filter_count_id", None),
            "news": news_data,
            "content_html": rendered_html
        }

        # Any extra context fields specified in frontmatter
        if "extra_context" in meta and isinstance(meta["extra_context"], dict):
            context.update(meta["extra_context"])

        tmpl = env.get_template(template_name)
        final_html = tmpl.render(**context)

        out_path = os.path.join(OUTPUT_DIR, out_name)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(final_html)

        print(f"  -> {md_filename} => _site/{out_name}")

    # 6. Copy static assets to _site/assets/
    if os.path.exists(ASSETS_DIR):
        dest_assets = os.path.join(OUTPUT_DIR, "assets")
        shutil.copytree(ASSETS_DIR, dest_assets, dirs_exist_ok=True)
        print("  -> Copied assets/ => _site/assets/")

    # 7. Copy model/ application directory to _site/model/
    if os.path.exists(MODEL_DIR):
        dest_model = os.path.join(OUTPUT_DIR, "model")
        shutil.copytree(MODEL_DIR, dest_model, dirs_exist_ok=True)
        for asset in ["flake.wasm", "wasm-base64.js"]:
            src_asset = os.path.join(SCRIPT_DIR, asset)
            if os.path.exists(src_asset):
                shutil.copy2(src_asset, os.path.join(dest_model, asset))
        print("  -> Copied model/ => _site/model/")

    root_data_dir = os.path.join(SCRIPT_DIR, "data")
    if os.path.exists(root_data_dir):
        dest_root_data = os.path.join(OUTPUT_DIR, "data")
        shutil.copytree(root_data_dir, dest_root_data, dirs_exist_ok=True)
        print("  -> Copied data/ => _site/data/")

    # 8. Ensure Favicon and .nojekyll in _site/
    ensure_favicon()
    with open(os.path.join(OUTPUT_DIR, ".nojekyll"), "w", encoding="utf-8") as f:
        f.write("# Disable Jekyll on GitHub Pages\n")
    print("  -> Created _site/.nojekyll and favicon")

    # 9. Create static /api/status health endpoint
    api_dir = os.path.join(OUTPUT_DIR, "api")
    os.makedirs(api_dir, exist_ok=True)
    with open(os.path.join(api_dir, "status"), "w", encoding="utf-8") as f:
        f.write(json.dumps({"status": "ok", "app": "flake-lake-model"}) + "\n")
    print("  -> Created _site/api/status endpoint")

    print("\n=== Website build completed successfully in _site/ ===")

if __name__ == "__main__":
    main()
