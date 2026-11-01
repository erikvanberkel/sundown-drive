# Sundown Drive

An original 80s arcade-style pseudo-3D road racer, built with plain HTML, CSS and canvas. There is no build step and no game library: every sprite, backdrop, song and sound effect is generated in code.

**Play it:** https://erikvanberkel.github.io/sundown-drive/

## How to play

Race through five stages against the clock. Each checkpoint adds time, and you need to reach the goal at the end of the fifth stage before the timer hits zero.

1. Press **Enter** on the title screen.
2. Tune the radio with **Left/Right** to pick a song, then press **Enter** to start.

| Key | Action |
| --- | --- |
| Arrow keys or WASD | Steer, accelerate (Up/W) and brake (Down/S) |
| Space or Shift | Boost (hold) |
| P or Esc | Pause |
| M | Music on/off |
| L | CRT scanlines on/off (off by default) |
| Enter | Start and confirm |

On touch screens, buttons appear for steering, gas, brake and boost.

### Scoring

- You earn points continuously, faster the quicker you drive.
- Passing traffic closely at high speed is a close call: +5,000 points and a refill of the boost meter.
- Reaching the goal adds a time bonus of 100,000 points for every second left on the clock.
- Your high score is saved in the browser.

### Boost and hazards

The boost meter fills slowly on its own and faster with close calls. Hold boost above about a third of top speed to burn it for extra acceleration and a higher top speed.

Driving off the road slows you down. Hitting roadside scenery or ramming traffic at speed flips the car end over end; a lighter touch only costs you speed.

## Stages

| Stage | Name | Time | Setting |
| --- | --- | --- | --- |
| 1 | Sunset Bay | 58 s to start | Sunset over the sea |
| 2 | Desert Ridge | +48 s | Daytime mesas |
| 3 | Neon City | +47 s | Night skyline |
| 4 | Pine Pass | +46 s | Snowy mountains at dusk |
| 5 | Starline | +45 s | Synthwave night |

The sky, scenery and road colours blend from one stage into the next.

## Music

Three original songs, synthesized live with the Web Audio API:

| Station | Song |
| --- | --- |
| 88.6 | Palm Shadow |
| 94.2 | Night Freeway |
| 101.7 | Coral Engine |

## Running locally

Serve the folder with any static web server and open it in a browser, for example:

```sh
python -m http.server 8000
```

Then go to http://localhost:8000. The only outside request is the Press Start 2P font from Google Fonts.

## Project layout

| File | Contents |
| --- | --- |
| `index.html` | Page, HUD and menus |
| `style.css` | Cabinet frame, HUD, CRT overlay and touch controls |
| `js/game.js` | Game state, physics, input, HUD and main loop |
| `js/track.js` | Stage themes and course construction |
| `js/render.js` | Pseudo-3D road renderer, sprite scaling and parallax |
| `js/sprites.js` | Procedural pixel-art scenery and backgrounds |
| `js/car.js` | The player's convertible |
| `js/traffic.js` | Traffic vehicles |
| `js/sound.js` | Engine sound and sound effects |
| `js/music.js` | Music engine and the three songs |

For debugging, `window.__sundown` exposes the live game state from the browser console.
