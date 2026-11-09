#!/usr/bin/env node
// fetch-images.mjs — generate (or re-use) one image per scene.
//
// Usage: node fetch-images.mjs <slug> [--provider horde] [--model Deliberate] [--force]
//
// Runs on YOUR machine, which has open internet.
//
// Default provider is AI Horde: free, no account, no API key. It is a queue of
// volunteered GPUs, so jobs are SUBMITTED first (two per second, which is the
// only hard limit) and then collected in parallel. Submitting all of them up
// front is what makes a 31-scene video take a couple of minutes instead of the
// ~23 minutes a strictly one-at-a-time service would need.
//
// Images are cached by a hash of the prompt, so re-rendering costs nothing and
// only changed scenes regenerate. A scene whose image cannot be fetched is left
// out of the manifest and the renderer draws it as vector art instead, so a
// rate limit or a dropped connection never fails the whole video.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const AGENT = 'faith-reel-studio:1.0:local';

const PROVIDERS = {
  /**
   * AI Horde — crowdsourced GPUs. No key: "0000000000" is the documented
   * anonymous key. Anonymous requests are lowest priority, so keep the sampler
   * work modest; a large image at high steps is refused for want of kudos.
   */
  horde: {
    mode: 'async',
    submitRateMs: 600,          // the API allows 2 submissions per second
    pollMs: 2500,
    maxWaitMs: 8 * 60 * 1000,
    defaultModel: 'Deliberate', // strong, widely hosted, good at flat illustration
    width: 512,
    height: 896,                // close to 9:16; falls back to 768 if refused
    steps: 22,
    async submit(prompt, seed, opts) {
      const body = {
        prompt,
        params: {
          sampler_name: 'k_euler_a',
          width: opts.width, height: opts.height,
          steps: opts.steps, n: 1, cfg_scale: 7, seed: String(seed),
        },
        models: [opts.model],
        nsfw: false, censor_nsfw: true, r2: true,
      };
      const r = await fetch('https://aihorde.net/api/v2/generate/async', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', apikey: '0000000000', 'Client-Agent': AGENT},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => ({}));
      if (j.id) return {id: j.id};
      return {error: j.message || `HTTP ${r.status}`, rc: j.rc};
    },
    async done(id) {
      const r = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`, {
        headers: {'Client-Agent': AGENT}, signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => ({}));
      return {done: j.done === true, faulted: j.faulted === true, queue: j.queue_position};
    },
    async collect(id) {
      const r = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`, {
        headers: {'Client-Agent': AGENT}, signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => ({}));
      return j.generations?.[0]?.img ?? null;
    },
  },

  /** Pollinations — also keyless, but roughly one image per 45s on the free tier. */
  pollinations: {
    mode: 'direct',
    rateMs: 46000,
    url: (prompt, seed) =>
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
      + `?width=768&height=1365&nologo=true&model=flux&seed=${seed}`,
  },
};

const MIN_BYTES = 12000; // smaller than this is an error page, not an image

/**
 * Pick the file extension from the bytes rather than the URL. Horde serves
 * WebP from R2 today but has served PNG and JPEG before; a file named .webp
 * that actually holds PNG works in most browsers by sniffing, but not in every
 * renderer, so name it correctly.
 */
export function extOf(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return 'webp';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node fetch-images.mjs <slug> [--provider horde] [--model Deliberate] [--force]');
    process.exit(1);
  }
  const providerName = argValue('--provider') ?? 'horde';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    console.error(`Unknown provider "${providerName}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(1);
  }
  const force = process.argv.includes('--force');

  const planPath = path.resolve(`stories/${slug}/scene-plan.json`);
  if (!fs.existsSync(planPath)) {
    console.error(`❌ Missing ${planPath}`);
    console.error('   Run prepare.mjs first — it writes the scene plan.');
    process.exit(1);
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const cacheDir = path.resolve('image-cache');
  const outDir = path.resolve('public/scenes');
  fs.mkdirSync(cacheDir, {recursive: true});
  fs.mkdirSync(outDir, {recursive: true});
  for (const f of fs.readdirSync(outDir)) {
    if (/^scene-\d+\.(jpg|jpeg|webp|png)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  }

  const sceneFile = (i, ext) => path.join(outDir, `scene-${String(i).padStart(3, '0')}.${ext}`);
  const manifest = [];
  const todo = [];

  // ── Re-use anything already generated for the same prompt ──
  for (let i = 0; i < plan.length; i++) {
    const key = hash(plan[i].prompt);
    const hit = ['webp', 'png', 'jpg']
      .map((e) => path.join(cacheDir, `${key}.${e}`))
      .find((f) => fs.existsSync(f) && fs.statSync(f).size > MIN_BYTES);
    if (!force && hit) {
      const ext = path.extname(hit).slice(1);
      fs.copyFileSync(hit, sceneFile(i, ext));
      manifest.push({index: i, file: path.basename(sceneFile(i, ext)), kind: plan[i].kind, cached: true});
    } else {
      todo.push({i, key, scene: plan[i]});
    }
  }

  console.log(`\n${plan.length} scenes — ${manifest.length} already cached, ${todo.length} to generate`);
  if (!todo.length) {
    finish(outDir, manifest, plan.length);
    return;
  }

  const model = argValue('--model') ?? provider.defaultModel;
  if (providerName === 'horde') console.log(`Provider: AI Horde (free, no key) · model: ${model}`);
  else console.log(`Provider: ${providerName}`);

  const results = provider.mode === 'async'
    ? await runAsync(provider, todo, model)
    : await runDirect(provider, todo);

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.buf) {
      const ext = extOf(r.buf);
      const cacheFile = path.join(cacheDir, `${r.key}.${ext}`);
      fs.writeFileSync(cacheFile, r.buf);
      fs.copyFileSync(cacheFile, sceneFile(r.i, ext));
      manifest.push({index: r.i, file: path.basename(sceneFile(r.i, ext)), kind: r.scene.kind, cached: false});
      ok += 1;
    } else {
      failed += 1;
      console.log(`  ✗ scene ${r.i + 1}: ${r.error ?? 'no image'} — will render as vector art`);
    }
  }

  manifest.sort((a, b) => a.index - b.index);
  console.log(`\n${ok} generated, ${failed} failed`);
  finish(outDir, manifest, plan.length);
}

/**
 * Submit every job first (respecting the 2-per-second cap), then poll them all
 * together. Jobs run concurrently across the horde's workers, so total time is
 * roughly the slowest single job rather than the sum of all of them.
 */
async function runAsync(provider, todo, model) {
  const opts = {model, width: provider.width, height: provider.height, steps: provider.steps};
  const jobs = [];

  process.stdout.write('Submitting');
  for (const item of todo) {
    let res = await provider.submit(item.scene.prompt, item.scene.seed ?? item.i, opts);
    // The anonymous budget refuses large or high-step requests; retry smaller.
    if (res.rc === 'KudosUpfront') {
      res = await provider.submit(item.scene.prompt, item.scene.seed ?? item.i,
        {...opts, width: 512, height: 768, steps: 18});
    }
    jobs.push({...item, id: res.id, error: res.error});
    process.stdout.write(res.id ? '.' : 'x');
    await sleep(provider.submitRateMs);
  }
  console.log(` ${jobs.filter((j) => j.id).length}/${jobs.length} queued`);

  const pending = new Set(jobs.filter((j) => j.id).map((j) => j.id));
  const started = Date.now();
  let lastReport = 0;

  while (pending.size && Date.now() - started < provider.maxWaitMs) {
    await sleep(provider.pollMs);
    await Promise.all([...pending].map(async (id) => {
      try {
        const st = await provider.done(id);
        if (st.done || st.faulted) pending.delete(id);
        if (st.faulted) {
          const j = jobs.find((x) => x.id === id);
          if (j) j.error = 'worker faulted';
        }
      } catch { /* transient — try again next poll */ }
    }));
    const elapsed = Math.round((Date.now() - started) / 1000);
    if (elapsed - lastReport >= 10) {
      lastReport = elapsed;
      console.log(`  ${jobs.length - pending.size}/${jobs.length} ready  (${elapsed}s)`);
    }
  }
  if (pending.size) console.log(`  ${pending.size} job(s) timed out`);

  for (const j of jobs) {
    if (!j.id || j.error) continue;
    try {
      const url = await provider.collect(j.id);
      if (!url) { j.error = 'no image returned'; continue; }
      j.buf = await grab(url);
      if (!j.buf) j.error = 'download failed';
    } catch (e) { j.error = e.message; }
  }
  return jobs;
}

/** One request per image, rate limited by the provider. */
async function runDirect(provider, todo) {
  const mins = Math.ceil((todo.length * provider.rateMs) / 60000);
  console.log(`⚠️  Rate limited to one image per ${Math.round(provider.rateMs / 1000)}s — about ${mins} minutes.\n`);
  for (let k = 0; k < todo.length; k++) {
    if (k > 0) await sleep(provider.rateMs);
    const item = todo[k];
    item.buf = await grab(provider.url(item.scene.prompt, item.scene.seed ?? item.i));
    if (!item.buf) item.error = 'fetch failed';
    console.log(`  ${k + 1}/${todo.length} ${item.buf ? '✓' : '✗'} ${item.scene.text.slice(0, 48)}`);
  }
  return todo;
}

async function grab(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(90000)});
      if (!r.ok) { await sleep(2000 * attempt); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length >= MIN_BYTES) return buf;
    } catch { /* retry */ }
    await sleep(2000 * attempt);
  }
  return null;
}

function finish(outDir, manifest, total) {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${manifest.length}/${total} scenes have images.`);
  if (manifest.length < total) console.log('The rest render as vector art, so the video is still complete.');
  console.log('Now re-run prepare.mjs to attach them, then render.\n');
}

// Only run when invoked directly, so the helpers above stay importable by tests.
import {pathToFileURL} from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('fetch-images failed:', err.message);
    process.exit(1);
  });
}
