# Stereogram Viewer
![Demo](demo.gif)

Use it at [stereo.cbbldtgthr.dev](https://stereo.cbbldtgthr.dev/)

A small static web app for **parallel (defocus) free-viewing** of a stereo pair: two photos side by side, one for each eye. Pick left and right images (or use bundled examples), then relax your eyes so each image goes to the correct eye.

## What makes it different

Scroll-wheel zoom does **not** resize the whole page. Each eye’s image lives in its own clipped frame; zoom and pan stay **locked together** so the same point in the scene stays aligned in both frames. That avoids the usual problem where browser zoom or a single “fit width” control throws off spacing for free-viewing. Many stereo tools resize the pair as one unit or only offer a coarse size control—here, zoom is interactive and centered under the cursor (or the frame center from the keyboard).

## Controls

- **Scroll** — zoom both panels in sync (cursor anchor).
- **Drag** — pan both images together inside their frames.
- **← / →** — relative size (how much of the viewport the pair uses).
- **Up / down arrows** — zoom toward the center.
- **Gap, crop** — spacing between frames and horizontal crop (percentage), still side by side.

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server (paths are relative).

## Docker

```bash
docker compose up -d --build
```

Then open **http://localhost:8083** (see `docker-compose.yml` for the host port).

Image is `nginx:alpine`; compose caps memory at 32 MB for a tiny footprint.

