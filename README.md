# SKS Infra Projects website

Source for https://sksinfraprojects.com, hosted on GitHub Pages (served from the `main` branch, custom domain set in `CNAME`).

It is a plain static site: no build step, no framework, no third-party scripts. Edit a file, commit to `main`, and GitHub Pages publishes it within a minute or two.

## What is here

| Path | What it is |
| --- | --- |
| `index.html` | The landing page: all copy lives here. |
| `404.html` | Shown for any address that does not exist. |
| `assets/css/main.css` | The whole design system (colours, type, layout, motion). |
| `assets/js/main.js` | Page behaviour: navigation, scroll effects, tabs, project rail. |
| `assets/js/world.js` | The line-drawn "corridor" that the hero and the sectors section fly through. |
| `assets/js/renderer.js` | Draws that corridor onto a canvas. |
| `assets/js/presence.js` | The India map: **cities and corridors are listed here**. |
| `assets/js/map-data.js` | Generated map geometry. Do not edit by hand. |
| `assets/img/` | Logo files, favicons, social share image. |
| `assets/fonts/` | Mona Sans and Geist Mono (SIL Open Font License, see `LICENSE.txt` there). |
| `assets/media/` | Empty for now: photographs and video go here. |

## Preview on your own computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly from the file system will not load the scripts; it needs a local server.)

## Common edits

### Text

All wording is in `index.html`. Each section is marked with a comment banner (`Hero`, `Who we are`, `Sectors`, `Delivery models`, `Projects`, `Presence`, `Clients`, `Work with us`, `Contact`).

### Contact details

The site currently shows one email address, `info@sksinfraprojects.com`, and the two office cities. To change the address, find and replace it throughout `index.html`. Phone numbers and street addresses can be added to the `offices` list in the Contact section and to the footer.

### Adding project photographs

Each project card shows a still from the animated film until a photograph is supplied. To use a photograph, save it in `assets/media/projects/` and put an image tag inside that card's `card__media` block:

```html
<div class="card__media">
  <img src="assets/media/projects/amritsar-bypass.jpg" alt="Amritsar Bypass under construction" loading="lazy">
  <span class="card__tag">Highways</span>
</div>
```

Landscape images around 1600 x 1300 pixels work best. Remove the `<div class="stage">…</div>` line from the card when you add the image.

### Adding a hero video

Save the film as `assets/media/hero.mp4` (10 to 20 seconds, 1920 x 1080, under about 6 MB, no sound) with a still frame as `assets/media/hero.jpg`, then add this as the first line inside `<div class="hero__media">` in `index.html`:

```html
<video class="hero__video" autoplay muted loop playsinline poster="assets/media/hero.jpg">
  <source src="assets/media/hero.mp4" type="video/mp4">
</video>
```

The animated corridor switches itself off when a video is present.

### Adding a project card

Copy one `<article class="card">…</article>` block in the Projects section and change the text. `data-still` picks the artwork: `bypass`, `ring`, `hills`, `corridor`, `rail`, `rail2` or `power`.

### Adding a city or corridor to the map

Open `assets/js/presence.js`. Add a row to `PLACES` with the name, latitude, longitude, state and type; add a row to `CORRIDORS` for a rail or road line. Then add the city name to the matching state in the Presence section of `index.html`. A new state needs the map geometry to be regenerated.

### Logo

`assets/img/logo-mark.svg` and `logo-lockup.svg` were traced from the supplied JPEG. If the original vector artwork (AI, EPS, CDR, PDF or SVG) is available, replace these files with exports from it, keeping the same file names. The `-light` versions are for dark backgrounds.

## Notes

- **Accessibility:** the page respects the "reduce motion" system setting (the film holds on still frames), works with a keyboard, and reads correctly with scripts switched off.
- **Performance:** nothing is loaded from other websites. The film adapts its quality to the device.
- **Map:** boundary data is from the DataMeet India community (CC BY 4.0) and follows the Survey of India depiction. The map is schematic and not to scale.
