# Stereogram Viewer
![Demo](demo.gif)

[Youtube video here](https://www.youtube.com/watch?v=Yd1yWBF3wrc)

Use it at [stereo.cbbldtgthr.dev](https://stereo.cbbldtgthr.dev/)

A small static web app for **parallel (defocus) free-viewing** of a stereo pair: two photos side by side, one for each eye. Pick left and right images (or use bundled examples), then relax your eyes so each image goes to the correct eye.

## Install for offline use

The hosted app is a **Progressive Web App**. Open [stereo.cbbldtgthr.dev](https://stereo.cbbldtgthr.dev/) once while online so the service worker can cache the shell and bundled examples. Then use your browser’s **Install** (desktop) or **Add to Home Screen** (mobile) option—often in the address bar menu or share sheet. After that you can launch it with no network; your own photos still need to be chosen from the device when offline.

## What makes it different

Scroll-wheel zoom does **not** resize the whole page. Each eye’s image lives in its own clipped frame; zoom and pan stay **locked together** so the same point in the scene stays aligned in both frames. That avoids the usual problem where browser zoom or a single “fit width” control throws off spacing for free-viewing. Many stereo tools resize the pair as one unit or only offer a coarse size control—here, zoom is interactive and centered under the cursor (or the frame center from the keyboard).

## Controls

- **Scroll** — zoom both panels in sync (cursor anchor).
- **Drag** — pan both images together inside their frames.
- **← / →** — relative size (how much of the viewport the pair uses).
- **Up / down arrows** — zoom toward the center.
- **Gap, crop** — spacing between frames and horizontal crop (percentage), still side by side.

## Embed in an iframe

You can embed the hosted viewer on another site. When it runs **inside an iframe** (`window.self !== window.top`), the **Choose pair** control and **Examples** dropdown are hidden so it acts as a fixed viewer.

**Image URLs** come from query parameters (both required):

- `left` — URL of the left-eye image  
- `right` — URL of the right-eye image  

Only `http:` and `https:` URLs are accepted. Resolve paths the usual way: absolute URLs, or paths relative to the viewer’s origin (e.g. under the same host as the app).

Encode the values when you build the iframe `src`, e.g. with `encodeURIComponent(url)`.

```html
<iframe
  src="https://stereo.cbbldtgthr.dev/?left=ENCODED_LEFT_URL&right=ENCODED_RIGHT_URL"
  title="Stereogram Viewer"
  width="100%"
  height="720"
  style="border:0;"
></iframe>
```

Images are requested with **`crossOrigin="anonymous"`**. For **Export** (and a clean canvas), the image hosts should send appropriate **CORS** headers; otherwise loading or export may fail for cross-origin files.

If the iframe URL has no `left`/`right` parameters, the viewer shows a short message explaining that the embed needs them.

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server (paths are relative).

## Docker

```bash
docker compose up -d --build
```

Then open **http://localhost:8083** (see `docker-compose.yml` for the host port).

Image is `nginx:alpine`; compose caps memory at 32 MB for a tiny footprint.

## License

[MIT](LICENSE)
