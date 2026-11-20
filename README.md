# SKS Infra Projects website

Source for https://sksinfraprojects.com, hosted on GitHub Pages (served from the `main` branch, custom domain set in `CNAME`).

It is a plain static site: no build step, no framework, no third-party scripts. Edit a file, commit to `main`, and GitHub Pages publishes it within a minute or two.

## What is here

| Path | What it is |
| --- | --- |
| `index.html` | The landing page: all copy lives here. |
| `privacy.html` | The privacy policy, published at `/privacy`. |
| `404.html` | Shown for any address that does not exist. |
| `assets/css/main.css` | The whole design system (colours, type, layout, motion). |
| `assets/js/main.js` | Page behaviour: navigation, scroll effects, tabs, project rail. |
| `assets/js/world.js` | The line-drawn "corridor" that the hero and the sectors section fly through. |
| `assets/js/renderer.js` | Draws that corridor onto a canvas. |
| `assets/js/presence.js` | The India map: **project sites and corridors are listed here**. |
| `assets/js/map-data.js` | Generated map geometry. Do not edit by hand. |
| `assets/img/` | Logo files, favicons, social share image. |
| `assets/img/clients/` | Logos of the authorities shown in the Clients section. |
| `assets/fonts/` | Mona Sans and Geist Mono (SIL Open Font License, see `LICENSE.txt` there). |
| `assets/media/` | Empty for now: photographs and video go here. |

## Preview on your own computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly from the file system will not load the scripts; it needs a local server.)

The privacy policy is at http://localhost:8000/privacy.html in this preview. The short address `/privacy`, which the links on the site use, only works on the live site.

## Common edits

### Text

All wording is in `index.html`. Each section is marked with a comment banner, in page order: `Hero`, `Who we are`, `Sectors`, `Projects`, `Presence`, `Clients`, `Delivery models`, `Work with us`, `Contact`.

### Contact details

The head-office card in the Contact section shows the Agra address, the email address `info@sksinfraprojects.com` and the Noida corporate office. To add a phone number, copy one `<li>…</li>` block inside `office__list` in `index.html` and change the heading and text. The same details appear in the footer and in the `application/ld+json` block near the top of the file (which search engines read), so update all three together. To change the email address, find and replace it throughout `index.html`.

### Contact form

The site has no server of its own, so the form cannot store or send messages by itself. As shipped, pressing **Send enquiry** checks the fields and then opens the visitor's own email app with the message already written and addressed to `info@sksinfraprojects.com`; the visitor presses send there.

To have enquiries delivered directly, without the visitor's email app, sign up with a form-handling service (for example Web3Forms or Formspree), and put the address it gives you in the form's `data-endpoint` attribute in `index.html`:

```html
<form class="form" data-contact-form data-endpoint="https://example-form-service.com/your-form-id" …>
```

The form then posts the name, email, message and consent fields to that address and shows a thank-you message on the page. Leave `data-endpoint` empty to go back to the email-app behaviour.

### Privacy policy

`privacy.html` is the privacy policy. On the live site it answers at https://sksinfraprojects.com/privacy (GitHub Pages serves the file without the `.html`). The footer of the home page links to it, and so does the consent line under the contact form. Keep the file name: the `/privacy` address is the one given to LinkedIn for the company's developer application.

- **Wording:** edit the text in `privacy.html`. When a change alters what the policy means, also change the effective date shown under the title.
- **Grievance Officer:** the name and designation are in section 11 of the policy.
- **Keep it true:** the policy says the site uses no analytics, advertising or tracking cookies, that enquiries are kept for up to 2 years and CVs for up to 12 months, and that a grievance is resolved within one month. If any of that changes (for example, if an analytics tool is added to the site), change the policy at the same time.

The page needs no script, and prints or saves as a PDF as a plain document.

### Client logos

Each tile in the Clients section is one `<li>` with an image from `assets/img/clients/`. To replace a logo, save the new file over the old one (same name) and update the `width` and `height` on its `<img>` so that it sits comfortably beside the others (roughly 110 to 200 wide and 40 to 76 tall). Vector (SVG) or large PNG files give the sharpest result. The logos belong to their respective organisations; check that you have their consent to display them.

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

### Updating the map and the project counts

The number of projects beside each state is plain text in the Presence section of `index.html`; change it there.

The marks on the map are listed in `assets/js/presence.js`, with no names: a single-site project is a row in `SITES` (latitude, longitude, state) and a corridor project is a row in `CORRIDORS` (the states it runs through, then its points). A state that is not yet one of the ten needs the map geometry to be regenerated.

### Logo

`assets/img/logo-mark.svg` and `logo-lockup.svg` were traced from the supplied JPEG. If the original vector artwork (AI, EPS, CDR, PDF or SVG) is available, replace these files with exports from it, keeping the same file names. The `-light` versions are for dark backgrounds.

The browser-tab icon is separate and lives at the top level of the site: `favicon-32x32.png` and `favicon-192x192.png` (the two files the pages link to), `favicon.ico` (for anything that asks for that address directly) and `apple-touch-icon.png` (used when someone adds the site to a phone home screen). They show the whole SKS logo, in its own colours, on a white tile. Keep them as ordinary PNG files: Safari does not accept a vector (SVG) tab icon. Browsers, Safari especially, remember tab icons for a long time, so a replacement can take a while to appear for people who have visited before.

## Notes

- **Accessibility:** the page respects the "reduce motion" system setting (the film holds on still frames), works with a keyboard, and reads correctly with scripts switched off.
- **Performance:** nothing is loaded from other websites. The film adapts its quality to the device.
- **Map:** boundary data is from the DataMeet India community (CC BY 4.0) and follows the Survey of India depiction. The map is schematic and not to scale.
