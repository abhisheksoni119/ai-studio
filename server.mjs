#!/usr/bin/env node
// server.mjs — Faith Reel Studio local web UI
// Usage: npm run ui
// Then open: http://localhost:3333

import http from 'http';
import fs from 'fs';
import path from 'path';
import {spawn} from 'child_process';
import {randomBytes} from 'crypto';

const PORT = 3333;
const ROOT = process.cwd();

// Active jobs: id → { events, done, clients, slug, outFile }
const jobs = new Map();

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url      = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'GET'  && pathname === '/')              return serveIndex(res);
  if (req.method === 'POST' && pathname === '/create')         return handleCreate(req, res);
  if (req.method === 'GET'  && pathname.startsWith('/stream/')) return handleStream(req, pathname.slice(8), res);
  if (req.method === 'GET'  && pathname.startsWith('/download/')) return handleDownload(pathname.slice(10), res);

  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        ✝  Faith Reel Studio              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Open in your browser:                   ║`);
  console.log(`║  http://localhost:${PORT}                   ║`);
  console.log('║                                          ║');
  console.log('║  Press Ctrl+C to stop.                   ║');
  console.log('╚══════════════════════════════════════════╝\n');
});

// ─── Serve the UI page ────────────────────────────────────────────────────────
function serveIndex(res) {
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(HTML);
}

// ─── Create a new video job ───────────────────────────────────────────────────
async function handleCreate(req, res) {
  try {
    const {fields, files} = await parseMultipart(req);

    const title     = (fields.title     || '').trim();
    const scripture = (fields.scripture || '').trim();
    const script    = (fields.script    || '').trim();
    const audioFile = files.audio;

    if (!title)     return badRequest(res, 'Please enter a video title.');
    if (!script)    return badRequest(res, 'Please paste your script.');
    if (!audioFile) return badRequest(res, 'Please upload your ElevenLabs MP3 file.');

    // Build a safe slug from the title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Create the story folder and write inputs
    const storyDir = path.join(ROOT, 'stories', slug);
    fs.mkdirSync(storyDir, {recursive: true});
    fs.writeFileSync(path.join(storyDir, 'script.txt'), script, 'utf8');
    fs.writeFileSync(path.join(storyDir, 'voice.mp3'),  audioFile.data);
    fs.writeFileSync(path.join(storyDir, 'story.json'), JSON.stringify({
      slug,
      title,
      scripture: scripture || '',
    }, null, 2), 'utf8');

    // Register the job
    const jobId   = randomBytes(8).toString('hex');
    const outFile = path.join(ROOT, 'out', `${slug}-reel.mp4`);
    jobs.set(jobId, {events: [], done: false, error: false, clients: [], slug, outFile});

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({jobId, slug}));

    // Run pipeline in background
    runJob(jobId, slug).catch(err => pushEvent(jobId, 'error', err.message));

  } catch (err) {
    console.error('handleCreate error:', err);
    res.writeHead(500, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: err.message}));
  }
}

// ─── SSE progress stream ──────────────────────────────────────────────────────
function handleStream(req, jobId, res) {
  const job = jobs.get(jobId);
  if (!job) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    return res.end('Job not found');
  }

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Replay buffered events for late-connecting clients
  for (const ev of job.events) res.write(ev);

  if (job.done) return res.end();

  job.clients.push(res);
  req.on('close', () => {
    job.clients = job.clients.filter(c => c !== res);
  });
}

// ─── Download finished MP4 ────────────────────────────────────────────────────
function handleDownload(slug, res) {
  const outFile = path.join(ROOT, 'out', `${slug}-reel.mp4`);
  if (!fs.existsSync(outFile)) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    return res.end('File not ready.');
  }
  const stat = fs.statSync(outFile);
  res.writeHead(200, {
    'Content-Type':        'video/mp4',
    'Content-Length':      stat.size,
    'Content-Disposition': `attachment; filename="${slug}-reel.mp4"`,
  });
  fs.createReadStream(outFile).pipe(res);
}

// ─── Run prepare → render pipeline ───────────────────────────────────────────
/**
 * Step 1 — read word timings out of the narration so captions land on the word
 * the narrator is actually saying.
 *
 * Never fails the job. Without it prepare.mjs times captions from a syllable
 * estimate, which is roughly 1.5s out on a read with an uneven pace; with it
 * the captions sit within a fraction of a second of the voice.
 */
async function syncCaptions(jobId, slug) {
  const wordsPath = path.join(ROOT, 'stories', slug, 'words.json');

  // Re-sync whenever the narration is newer than the timings, so swapping in a
  // fresh take does not leave the captions pinned to the old one.
  const voicePath = path.join(ROOT, 'stories', slug, 'voice.mp3');
  if (fs.existsSync(wordsPath) && fs.existsSync(voicePath) &&
      fs.statSync(wordsPath).mtimeMs >= fs.statSync(voicePath).mtimeMs) {
    pushEvent(jobId, 'log', '🎙️ Step 1 of 3: Captions are already synced to this voice track — skipping.');
    return;
  }

  if (!fs.existsSync(path.join(ROOT, 'node_modules', '@huggingface', 'transformers'))) {
    pushEvent(jobId, 'log', '🎙️ Step 1 of 3: Caption sync is not installed — captions will use the timing estimate.');
    pushEvent(jobId, 'log', '   To turn it on once (about 300 MB, then it works offline), run this in the project folder:');
    pushEvent(jobId, 'log', '       npm run caption-sync-setup');
    return;
  }

  pushEvent(jobId, 'log', '🎙️ Step 1 of 3: Listening to the voice track to time the captions...');
  pushEvent(jobId, 'log', '   (the very first run downloads the speech model; after that it is offline)');
  try {
    await runProcess(jobId, 'node', ['transcribe.mjs', slug]);
  } catch {
    // A failed sync is a downgrade, not a broken job: prepare.mjs falls back.
    pushEvent(jobId, 'log', '⚠️ Caption sync did not finish — carrying on with the timing estimate.');
  }
}

async function runJob(jobId, slug) {
  const job = jobs.get(jobId);

  await syncCaptions(jobId, slug);

  pushEvent(jobId, 'log', '');
  pushEvent(jobId, 'log', '📝 Step 2 of 3: Preparing timeline from your script and audio...');
  await runProcess(jobId, 'node', ['prepare.mjs', slug]);

  pushEvent(jobId, 'log', '');
  pushEvent(jobId, 'log', '🎬 Step 3 of 3: Rendering video — this takes 5–15 minutes...');

  fs.mkdirSync(path.join(ROOT, 'out'), {recursive: true});
  await runProcess(jobId, 'node', ['render.mjs', 'video', slug]);

  if (fs.existsSync(job.outFile)) {
    const sizeMB = (fs.statSync(job.outFile).size / 1024 / 1024).toFixed(1);
    const absPath = path.resolve(job.outFile);
    pushEvent(jobId, 'log', '');
    pushEvent(jobId, 'log', `✅ Video ready! Size: ${sizeMB} MB`);
    pushEvent(jobId, 'log', `📁 Saved to: ${absPath}`);
    pushEvent(jobId, 'done', JSON.stringify({slug, sizeMB, path: absPath}));
  } else {
    pushEvent(jobId, 'error', 'Render finished but the output file was not found. Check the log above for errors.');
  }

  job.done = true;
  for (const client of job.clients) client.end();
}

// Strip ANSI escape codes so log is readable in the browser
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\][^\x07]*\x07/g, '');
}

function runProcess(jobId, cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {cwd: ROOT, shell: true, env: process.env});
    const stderrLines = []; // collect stderr for final error summary

    proc.stdout.on('data', d => {
      const msg = stripAnsi(d.toString());
      // Split on \r\n, \r, or \n — handles Windows line endings and Remotion's \r progress
      for (const line of msg.split(/\r\n|\r|\n/)) {
        const t = line.trim();
        if (t) pushEvent(jobId, 'log', t);
      }
    });

    proc.stderr.on('data', d => {
      const msg = stripAnsi(d.toString());
      for (const line of msg.split(/\r\n|\r|\n/)) {
        const t = line.trim();
        if (!t) continue;
        // Skip Remotion's noisy spinner / progress lines (they contain ✓ ▶ etc.)
        if (/^[─-╿‘-‟■-◿]/.test(t)) continue;
        stderrLines.push(t);
        pushEvent(jobId, 'log', `⚠ ${t}`);
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        // Surface the last 8 lines of stderr as the primary error hint
        const errSummary = stderrLines.slice(-8).join('\n');
        const hint = errSummary
          ? `Render failed (code ${code}):\n${errSummary}\n\n→ Check the "Faith Reel Studio - Server" terminal window for the full error.`
          : `Render process exited with code ${code}.\n→ Check the "Faith Reel Studio - Server" terminal window for the full error.`;
        reject(new Error(hint));
      }
    });

    proc.on('error', reject);
  });
}

function pushEvent(jobId, type, data) {
  const job = jobs.get(jobId);
  if (!job) return;
  const ev = `event: ${type}\ndata: ${data}\n\n`;
  job.events.push(ev);
  for (const client of job.clients) client.write(ev);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function badRequest(res, msg) {
  res.writeHead(400, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({error: msg}));
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const ct   = req.headers['content-type'] || '';
        const bm   = ct.match(/boundary=([^\s;]+)/);
        if (!bm) return reject(new Error('No boundary in Content-Type header'));
        resolve(parseMultipartBuffer(body, bm[1]));
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function parseMultipartBuffer(body, boundary) {
  const fields = {};
  const files  = {};
  const SEP    = Buffer.from('\r\n--' + boundary);
  const FIRST  = Buffer.from('--' + boundary + '\r\n');
  const CRLF2  = Buffer.from('\r\n\r\n');

  let pos = body.indexOf(FIRST);
  if (pos === -1) return {fields, files};
  pos += FIRST.length;

  while (pos < body.length) {
    const headEnd = body.indexOf(CRLF2, pos);
    if (headEnd === -1) break;

    const headers   = body.slice(pos, headEnd).toString();
    const dataStart = headEnd + 4;
    const nextSep   = body.indexOf(SEP, dataStart);
    const dataEnd   = nextSep === -1 ? body.length : nextSep;
    const data      = body.slice(dataStart, dataEnd);

    const nameMatch     = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]*?)"/);

    if (nameMatch) {
      const name = nameMatch[1];
      if (filenameMatch) {
        files[name] = {filename: filenameMatch[1], data};
      } else {
        fields[name] = data.toString('utf8');
      }
    }

    if (nextSep === -1) break;
    pos = nextSep + SEP.length;
    if (body[pos] === 0x2D && body[pos + 1] === 0x2D) break; // --boundary-- end marker
    if (body[pos] === 0x0D && body[pos + 1] === 0x0A) pos += 2;
  }

  return {fields, files};
}

// ─── Inline HTML page ─────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Faith Reel Studio</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #0d0d0f;
    --card:    #17171a;
    --border:  #2a2a30;
    --text:    #e8e6e0;
    --muted:   #888;
    --ember:   #d4823a;
    --gold:    #c9a84c;
    --success: #4caf76;
    --error:   #e05252;
    --radius:  10px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: Georgia, 'Times New Roman', serif;
    min-height: 100vh;
    padding: 2rem 1rem 4rem;
  }

  .wrap {
    max-width: 680px;
    margin: 0 auto;
  }

  header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  header h1 {
    font-size: 2rem;
    font-weight: normal;
    letter-spacing: 0.05em;
    color: var(--gold);
    margin-bottom: 0.4rem;
  }

  header p {
    color: var(--muted);
    font-size: 0.95rem;
    font-style: italic;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.75rem;
    margin-bottom: 1.25rem;
  }

  .notice {
    background: #1a1508;
    border: 1px solid #4a3a10;
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    font-size: 0.88rem;
    color: #c9a84c;
    line-height: 1.6;
  }

  .notice strong { display: block; margin-bottom: 0.25rem; }

  label {
    display: block;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.4rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .field { margin-bottom: 1.25rem; }
  .field:last-child { margin-bottom: 0; }

  input[type="text"],
  textarea {
    width: 100%;
    background: #0d0d0f;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: inherit;
    font-size: 0.97rem;
    padding: 0.65rem 0.85rem;
    transition: border-color 0.2s;
    outline: none;
  }

  input[type="text"]:focus,
  textarea:focus {
    border-color: var(--ember);
  }

  textarea {
    resize: vertical;
    min-height: 220px;
    line-height: 1.7;
  }

  .file-area {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .file-area:hover,
  .file-area.over {
    border-color: var(--ember);
    background: #1a1208;
  }

  .file-area input[type="file"] { display: none; }

  .file-label {
    font-size: 0.95rem;
    color: var(--muted);
  }

  .file-label span {
    color: var(--ember);
    text-decoration: underline;
    cursor: pointer;
  }

  #file-name {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--success);
    min-height: 1.2em;
  }

  .hint {
    font-size: 0.82rem;
    color: var(--muted);
    margin-top: 0.4rem;
    font-style: italic;
  }

  button[type="submit"] {
    width: 100%;
    padding: 0.9rem;
    background: var(--ember);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 1.05rem;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    margin-top: 0.5rem;
    letter-spacing: 0.03em;
  }

  button[type="submit"]:hover:not(:disabled) { opacity: 0.88; }
  button[type="submit"]:active:not(:disabled) { transform: scale(0.98); }
  button[type="submit"]:disabled { opacity: 0.45; cursor: not-allowed; }

  #progress-section { display: none; }
  #progress-section h2 {
    font-size: 1.1rem;
    font-weight: normal;
    color: var(--gold);
    margin-bottom: 0.75rem;
    letter-spacing: 0.04em;
  }

  #log {
    background: #0a0a0c;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    color: #bbb;
    line-height: 1.6;
    max-height: 320px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .log-line { display: block; }
  .log-error { color: var(--error); }
  .log-success { color: var(--success); }

  #result-box {
    display: none;
    margin-top: 1.25rem;
    padding: 1.25rem;
    background: #0a1a0e;
    border: 1px solid #2a5a36;
    border-radius: var(--radius);
    text-align: center;
  }

  #result-box p {
    color: var(--success);
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  #result-box .path-info {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--muted);
    margin-bottom: 1rem;
    word-break: break-all;
  }

  .btn-download {
    display: inline-block;
    padding: 0.65rem 1.5rem;
    background: var(--success);
    color: #fff;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.95rem;
    transition: opacity 0.2s;
  }

  .btn-download:hover { opacity: 0.85; }

  #error-box {
    display: none;
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    background: #1a0a0a;
    border: 1px solid #5a2020;
    border-radius: 6px;
    color: var(--error);
    font-size: 0.9rem;
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>✝ Faith Reel Studio</h1>
    <p>Create Bible story reels from your ElevenLabs narration</p>
  </header>

  <div class="notice">
    <strong>⚠️ Before publishing:</strong>
    Background music from <code>pad.mp3</code> will be added to your video.
    Please verify you have the rights to use this music track for public or commercial videos before uploading to YouTube or Instagram.
  </div>

  <div class="card">
    <div class="field">
      <label for="title">Video Title</label>
      <input type="text" id="title" placeholder="e.g. How Can I Trust God When I Feel Anxious?" autocomplete="off">
    </div>

    <div class="field">
      <label for="scripture">Scripture Reference <span style="font-style:italic;text-transform:none;">(optional)</span></label>
      <input type="text" id="scripture" placeholder="e.g. Philippians 4:6-7" autocomplete="off">
    </div>

    <div class="field">
      <label for="script">Script — one sentence per line</label>
      <textarea id="script" placeholder="Paste your ChatGPT script here.
One sentence or short phrase per line.
Each line will appear as a caption on screen.
Press Enter between each line."></textarea>
      <p class="hint">
        Each line = one caption. Keep lines short (one thought per line) for best timing.
        Captions are timed proportionally to character count — they approximate your speech but may drift slightly.
      </p>
    </div>

    <div class="field">
      <label>ElevenLabs MP3 File</label>
      <div class="file-area" id="drop-zone">
        <input type="file" id="audio" accept=".mp3,audio/mpeg">
        <p class="file-label">Drag &amp; drop your MP3 here, or <span onclick="document.getElementById('audio').click()">browse</span></p>
        <p id="file-name"></p>
      </div>
      <p class="hint">Export your narration from ElevenLabs as MP3, then select or drop it here.</p>
    </div>

    <button type="submit" id="submit-btn" onclick="startJob()">🎬 Create Video</button>
  </div>

  <div id="progress-section">
    <div class="card">
      <h2 id="progress-title">Progress</h2>
      <div id="log"></div>
      <div id="error-box"></div>
      <div id="result-box">
        <p>✅ Your video is ready!</p>
        <p class="path-info" id="file-path"></p>
        <a id="download-link" class="btn-download" href="#">⬇️ Download MP4</a>
      </div>
    </div>
  </div>

</div>

<script>
  // File picker
  const audioInput = document.getElementById('audio');
  const fileNameEl = document.getElementById('file-name');
  const dropZone   = document.getElementById('drop-zone');

  audioInput.addEventListener('change', () => {
    if (audioInput.files[0]) fileNameEl.textContent = '✓ ' + audioInput.files[0].name;
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'audio/mpeg') {
      const dt = new DataTransfer();
      dt.items.add(f);
      audioInput.files = dt.files;
      fileNameEl.textContent = '✓ ' + f.name;
    } else {
      fileNameEl.textContent = '⚠️ Please drop an MP3 file.';
    }
  });

  // Submit
  async function startJob() {
    const title     = document.getElementById('title').value.trim();
    const scripture = document.getElementById('scripture').value.trim();
    const script    = document.getElementById('script').value.trim();
    const audio     = audioInput.files[0];

    if (!title)  return alert('Please enter a video title.');
    if (!script) return alert('Please paste your script.');
    if (!audio)  return alert('Please upload your ElevenLabs MP3 file.');

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Starting…';

    document.getElementById('progress-section').style.display = 'block';
    document.getElementById('progress-title').textContent = 'Progress — ' + title;
    document.getElementById('log').innerHTML = '';
    document.getElementById('result-box').style.display = 'none';
    document.getElementById('error-box').style.display = 'none';

    const form = new FormData();
    form.append('title',     title);
    form.append('scripture', scripture);
    form.append('script',    script);
    form.append('audio',     audio, audio.name);

    let slug = '';
    try {
      const res  = await fetch('/create', {method: 'POST', body: form});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      slug = data.slug;
      streamProgress(data.jobId, slug);
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = '🎬 Create Video';
    }
  }

  function streamProgress(jobId, slug) {
    const es = new EventSource('/stream/' + jobId);

    es.addEventListener('log', e => {
      appendLog(e.data);
    });

    es.addEventListener('done', e => {
      es.close();
      const info = JSON.parse(e.data);
      document.getElementById('result-box').style.display = 'block';
      document.getElementById('file-path').textContent = '📁 ' + info.path + ' (' + info.sizeMB + ' MB)';
      document.getElementById('download-link').href = '/download/' + info.slug;
      document.getElementById('submit-btn').disabled = false;
      document.getElementById('submit-btn').textContent = '🎬 Create Another Video';
      scrollLog();
    });

    es.addEventListener('error', e => {
      es.close();
      const msg = e.data || 'An error occurred during rendering.';
      appendLog('❌ ' + msg, true);
      showError(msg);
      document.getElementById('submit-btn').disabled = false;
      document.getElementById('submit-btn').textContent = '🎬 Try Again';
    });

    es.onerror = () => {
      // Connection closed normally after done/error
    };
  }

  function appendLog(text, isError) {
    const log  = document.getElementById('log');
    const span = document.createElement('span');
    span.className = 'log-line' + (isError ? ' log-error' : '');
    span.textContent = text;
    log.appendChild(span);
    log.appendChild(document.createTextNode('\\n'));
    scrollLog();
  }

  function scrollLog() {
    const log = document.getElementById('log');
    log.scrollTop = log.scrollHeight;
  }

  function showError(msg) {
    const box = document.getElementById('error-box');
    box.style.display = 'block';
    box.textContent   = '⚠️ ' + msg;
  }
</script>
</body>
</html>`;
