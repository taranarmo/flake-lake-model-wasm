## Summary

<!-- Briefly describe what this PR changes and why. -->

## Related Issues

<!-- Link related issues using GitHub keywords, e.g. Fixes #123, Refs #45 -->

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature or UI enhancement
- [ ] Documentation or site content update (`content/`, `site_data/`, `README.md`)
- [ ] Build, Nix, CI, or dependency update
- [ ] Refactoring or test improvement

## Affected Areas

- [ ] Web simulator UI (`model/index.html`, `app.js`, `style.css`)
- [ ] WebAssembly engine or compilation (`flake-engine.js`, `build.sh`, `test_flake_wasm.js`)
- [ ] Static site generator or templates (`build_site.py`, `templates/`)
- [ ] Site Markdown content or data (`content/`, `site_data/`, `assets/`)
- [ ] Nix flake / GitHub Actions workflow (`flake.nix`, `.github/`)

## Verification & Testing

<!-- List the checks you ran after your final edit and any browser/device environments tested. -->

- [ ] `node test_flake_wasm.js` (or `make test`) passes
- [ ] `uv run build_site.py` (or `make site`) builds cleanly without errors
- [ ] `nix build` succeeds (if WASM, Nix, or build scripts were modified)
- [ ] Verified in browser (desktop/mobile layout, no unexpected DevTools console errors)

## Screenshots (if applicable)

<!-- Add before/after screenshots for UI or visualization changes. -->

## Checklist

- [ ] Generated output directories (`_site/`, `result/`) are not committed
- [ ] Changes follow the project's existing conventions and clean academic typography (no emojis in site/docs)
- [ ] Documentation or inline comments are updated where behavior changed
