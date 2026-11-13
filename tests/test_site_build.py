import glob
import json
import os
import re
import struct
import sys
import unittest
import urllib.parse
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import build_site


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("href", "src") and v:
                self.links.append((tag, k, v))


class SiteBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build_site.main()
        cls.site_dir = build_site.OUTPUT_DIR

    def test_slugify_handles_german_umlauts_and_punctuation(self):
        self.assertEqual(build_site.slugify("Müggelsee & Stechlin"), "mueggelsee-and-stechlin")
        self.assertEqual(build_site.slugify("<strong>FLake</strong> 1.0"), "flake-10")

    def test_markdown_frontmatter_and_no_emojis(self):
        emoji_re = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")
        md_files = sorted(glob.glob(os.path.join(ROOT, "content", "*.md")))
        tmpl_files = sorted(glob.glob(os.path.join(ROOT, "templates", "*.html")))
        self.assertGreaterEqual(len(md_files), 13)

        for path in md_files:
            meta, body = build_site.parse_markdown_file(path)
            self.assertIn("title", meta, f"{path} missing title frontmatter")
            self.assertTrue(body.strip(), f"{path} has empty markdown body")

        for path in md_files + tmpl_files:
            with open(path, "r", encoding="utf-8") as f:
                hits = emoji_re.findall(f.read())
            self.assertEqual(hits, [], f"Emoji found in {path}: {hits}")

    def test_generated_site_pages_and_required_artifacts(self):
        required = [
            "index.html",
            "apps.html",
            "users.html",
            "docs.html",
            "hints.html",
            "papers.html",
            "downloads.html",
            "test-runs.html",
            "external-data.html",
            "observational-data.html",
            "links.html",
            "forum.html",
            "contacts.html",
            os.path.join("model", "index.html"),
            os.path.join("model", "flake.wasm"),
            os.path.join("model", "wasm-base64.js"),
            "favicon.ico",
            os.path.join("model", "favicon.ico"),
            ".nojekyll",
            os.path.join("api", "status"),
        ]
        for rel in required:
            full = os.path.join(self.site_dir, rel)
            self.assertTrue(os.path.exists(full), f"Missing generated output: {rel}")
            self.assertGreater(os.path.getsize(full), 0, f"Empty generated output: {rel}")

        with open(os.path.join(self.site_dir, "favicon.ico"), "rb") as f:
            header = f.read(6)
        reserved, ico_type, count = struct.unpack("<HHH", header)
        self.assertEqual((reserved, ico_type), (0, 1))
        self.assertGreaterEqual(count, 1)

        with open(os.path.join(self.site_dir, "api", "status"), "r", encoding="utf-8") as f:
            status = json.load(f)
        self.assertEqual(status.get("status"), "ok")

    def test_all_internal_links_resolve_in_site(self):
        broken = []
        html_files = sorted(glob.glob(os.path.join(self.site_dir, "**", "*.html"), recursive=True))
        self.assertGreaterEqual(len(html_files), 14)

        for html_path in html_files:
            rel_dir = os.path.dirname(html_path)
            parser = LinkCollector()
            with open(html_path, "r", encoding="utf-8") as f:
                parser.feed(f.read())
            for _, _, val in parser.links:
                if val.startswith(("http://", "https://", "mailto:", "javascript:", "#", "data:")):
                    continue
                path_only = urllib.parse.urlparse(val).path
                if not path_only:
                    continue
                target = os.path.normpath(os.path.join(rel_dir, path_only))
                if path_only.endswith("/") or os.path.isdir(target):
                    target = os.path.join(target, "index.html")
                if not os.path.exists(target):
                    broken.append((os.path.relpath(html_path, self.site_dir), val))

        self.assertEqual(broken, [], f"Broken internal links found: {broken}")


if __name__ == "__main__":
    unittest.main()
