# Faith Reel Studio

Remotion-based studio for 2D Bible-story reels (and later: character conversations, verse cards, UGC ads).

## Run
    npm install
    npm run studio     # live preview in browser
    npm run render     # -> out/abraham-reel.mp4
    npm run stills     # -> out/still-<frame>.png for quick checks

## Layout
- src/timeline.ts — voice segments, caption blocks, scene cuts
- src/Art.tsx     — reusable SVG pieces (Sky, Stars, Glow, Ridge, figures, props)
- src/Scenes.tsx  — one component per scene, mapped by id in SCENE_MAP
- src/Reel.tsx    — assembles scenes, crossfades, karaoke captions, audio
- public/         — voice + music
- stories/        — notes per finished reel

## Roadmap
1. Data-driven: one story.json per reel instead of editing timeline.ts
2. Auto word timestamps from the voice file (no hand timing)
3. Aspect presets: 9:16, 16:9, 1:1
4. Modes: story narration · character + Jesus conversation · verse card · UGC/raw-video ad
