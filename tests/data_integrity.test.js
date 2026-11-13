const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

describe('Root and model/ runtime artifact sync', () => {
  it('keeps shared JS, CSS, and WASM assets byte-identical between root and model/', () => {
    for (const rel of ['app.js', 'flake-engine.js', 'style.css', 'world-geo.js', 'wasm-base64.js', 'flake.wasm']) {
      const rootFile = path.join(ROOT, rel);
      const modelFile = path.join(ROOT, 'model', rel);
      assert.ok(fs.existsSync(rootFile), `Missing root file: ${rel}`);
      assert.ok(fs.existsSync(modelFile), `Missing model/ file: ${rel}`);
      assert.equal(sha256(rootFile), sha256(modelFile), `${rel} drifted between root and model/${rel}`);
    }
  });
});

describe('Bundled scientific and site JSON datasets', () => {
  it('validates world-geo.js land polygons', () => {
    const code = fs.readFileSync(path.join(ROOT, 'world-geo.js'), 'utf8');
    const ctx = { globalThis: {} };
    ctx.globalThis = ctx;
    vm.runInNewContext(code, ctx);
    const geo = ctx.FLAKE_WORLD_GEO;
    assert.ok(geo && Array.isArray(geo.land) && geo.land.length > 50);
    for (const poly of geo.land) {
      assert.equal(poly.type, 'Polygon');
      assert.ok(Array.isArray(poly.coordinates[0]) && poly.coordinates[0].length >= 3);
      for (const [lon, lat] of poly.coordinates[0]) {
        assert.ok(lon >= -180 && lon <= 180, `Invalid lon ${lon}`);
        assert.ok(lat >= -90 && lat <= 90, `Invalid lat ${lat}`);
      }
    }
  });

  it('validates climatology_harmonics.json grid integrity', () => {
    const harm = JSON.parse(fs.readFileSync(path.join(ROOT, 'model/data/climatology_harmonics.json'), 'utf8'));
    assert.equal(harm.resolutionDeg, 5.0);
    assert.equal(harm.variables.length, 14);
    assert.equal(harm.count, harm.grid.length);
    assert.ok(harm.grid.length > 1000);

    for (const row of harm.grid) {
      assert.equal(row.length, 14);
      assert.ok(row.every(Number.isFinite));
      assert.ok(row[0] >= -90 && row[0] <= 90);
      assert.ok(row[1] >= -180 && row[1] <= 180);
      assert.ok(row[10] >= 0); // wind_mean
      assert.ok(row[12] >= 0 && row[12] <= 1); // cl_mean
    }
  });

  it('validates perpetual lake index and all referenced perpetual datasets', () => {
    const perpDir = path.join(ROOT, 'model/data/perpetual');
    const index = JSON.parse(fs.readFileSync(path.join(perpDir, 'index.json'), 'utf8'));
    assert.ok(Array.isArray(index) && index.length >= 10);

    for (const entry of index) {
      assert.ok(entry.id && entry.name);
      assert.ok(entry.defaultDepth > 0 && entry.defaultFetch > 0 && entry.defaultClarity > 0);
      const dataPath = path.join(perpDir, `${entry.id}.json`);
      assert.ok(fs.existsSync(dataPath), `Missing perpetual dataset: ${entry.id}.json`);
      const ds = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      assert.equal(ds.steps.length, 2920, `${entry.id} must have 2920 3-hourly steps`);
      for (const s of ds.steps) {
        assert.equal(s.length, 5);
        assert.ok(s.every(Number.isFinite));
        assert.ok(s[0] >= 0, 'solar must be non-negative');
        assert.ok(s[3] >= 0, 'wind must be non-negative');
        assert.ok(s[4] >= 0 && s[4] <= 1, 'cloud cover must be in [0, 1]');
      }
    }
  });

  it('validates curated benchmark lake datasets', () => {
    const lakesDir = path.join(ROOT, 'model/data/lakes');
    const files = fs.readdirSync(lakesDir).filter(f => f.endsWith('.json')).sort();
    assert.ok(files.length >= 10);

    for (const file of files) {
      const ds = JSON.parse(fs.readFileSync(path.join(lakesDir, file), 'utf8'));
      assert.ok(ds.id && ds.name, `${file} missing id/name`);
      assert.ok(ds.depth > 0 && ds.fetch > 0 && ds.clarity > 0, `${file} invalid lake params`);
      assert.ok(Array.isArray(ds.steps) && ds.steps.length > 0, `${file} has no steps`);
    }
  });

  it('validates site_data JSON files', () => {
    const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'site_data/news.json'), 'utf8'));
    assert.ok(Array.isArray(news) && news.length > 0);
    for (const item of news) {
      assert.ok(item.title && item.date);
    }

    const users = JSON.parse(fs.readFileSync(path.join(ROOT, 'site_data/users.json'), 'utf8'));
    assert.ok(Array.isArray(users) && users.length > 20);
    for (const u of users) {
      assert.ok(u.institution);
    }

    const papers = JSON.parse(fs.readFileSync(path.join(ROOT, 'site_data/papers.json'), 'utf8'));
    assert.ok(papers && typeof papers === 'object' && Object.keys(papers).length > 0);
  });
});
