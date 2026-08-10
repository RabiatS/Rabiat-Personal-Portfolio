# Rabiat Sadiq Portfolio Website

[Website](https://www.rabiatsadiq.com)

A comprehensive, interactive portfolio website showcasing my interdisciplinary work in Applied ML, XR, and Human-Computer Interaction.

## File Structure

```
Rabiat-Personal-Portfolio/
├── index.html               # Home page with hero, featured projects, timeline
├── vr.html                  # WebXR immersive view (inside the site hero + featured work)
├── projects.html            # Comprehensive projects page with filtering
├── coursework.html          # Coursework showcase page
├── contact.html             # Contact form page
├── cool.html                # Small self-built tools + cool sites
├── em-dash-remover.html     # Standalone tool: em/en-dash cleanup for AI text
├── sticky-counter.html      # Standalone tool: CMU MHCI sticky note observatory
├── hq-daily-planner.html    # Standalone tool: terminal-style daily planner
│
├── case-studies/            # Detailed case study pages
│   ├── case-study.html                 # Magic Mitts haptic VR glove
│   ├── case-study-ps.html              # PlayStation internship
│   ├── case-study-spotify.html         # Spotify vs AI research
│   ├── case-study-assuage.html         # Assuage health ML
│   ├── case-study-pain-xr.html         # XR pain perception (CMU)
│   └── case-study-amazon-music.html    # Amazon Music MHCI capstone
│
├── assets/
│   ├── style.css             # Main stylesheet (design tokens, all pages)
│   ├── discovery.css         # Signal Lab hidden-easter-egg styles
│   ├── script.js             # Theme, nav, project grid, VR eye, plain/rainbow modes
│   ├── discovery.js          # Signal Lab (type "build" on the homepage)
│   ├── builder-mode.js       # Shared eligibility check for the 3D builder cube
│   ├── builder-cube.js       # Three.js scroll companion (homepage, desktop)
│   ├── cube-fall.js          # Click-to-drop animation for the builder cube
│   ├── launch-scroll.js      # GSAP scroll reveals for builder-mode extras
│   ├── timeline-scroll.js    # GSAP scroll reveals for the experience timeline
│   ├── vr-lobby.js           # A-Frame scene builder for vr.html
│   ├── vr-lobby.json         # Content model for the VR scene
│   ├── projects.json         # Project data — source of truth, fetched at runtime
│   ├── favicon.svg
│   ├── Rabiat_Sadiq_Resume.pdf
│   └── img/                  # Image assets (projects/, portrait, etc.)
│
└── files/                    # PDFs, videos, and other downloadable documents
    ├── Rabiat_Sadiq_Resume_DEC_2025.pdf
    ├── amazon-music/
    └── ctrl-alt-elite/
```

## Features

- **Data-driven Projects**: `projects.html` fetches [`assets/projects.json`](assets/projects.json) at runtime; a generated copy in `script.js` (`EMBEDDED_PROJECTS`) is the fallback when the page is opened over `file://`. Edit the JSON — never hand-edit the embedded copy.
- **Interactive Filtering**: Filter projects by tags (XR, ML, HCI, Research, etc.) with real-time updates
- **Search Functionality**: Real-time search across project titles and descriptions
- **Case Studies**: Detailed case study pages for major projects with rich content
- **Responsive Design**: Fluid layout with a real mobile nav (hamburger menu) below 900px
- **Dark Mode**: Theme toggle with system preference detection and localStorage persistence
- **Secret Rainbow Mode**: Hidden party mode activated by holding the theme toggle button
- **Interactive Galaxy Canvas**: Animated nebula background with parallax effect and shooting stars
- **VR Eye Animation**: Interactive VR headset with eyes that follow cursor movement — click it to open the HQ Daily Planner
- **View in VR (WebXR)**: On supported headsets (Quest Browser, etc.), a header link opens [`vr.html`](vr.html) — an immersive 3D version of the home hero and featured projects (A-Frame)
- **Card Tilt Effects**: 3D tilt animations on project cards (configurable: off, desktop-only, or all devices)
- **Color Scheme Switcher**: 31 color schemes to customize the site's appearance. Every scheme derives a contrast-safe `--primary-readable` / `--on-primary` pair at runtime (see `applyReadableTokens` in `script.js`), so link and button text stays legible even on the lightest palettes.
- **Signal Lab**: hidden easter egg — type `build` on the homepage, or triple-tap the scroll cue on mobile
- **Smooth Animations**: CSS transitions and JavaScript-powered animations throughout
- **Accessibility**: ARIA labels, keyboard navigation, reduced-motion support, and a real focus-trapped mobile menu

## Adding a New Project

1. Open `assets/projects.json`
2. Add a new project object to the `projects` array:

```json
{
  "id": "project-id",
  "title": "Project Title",
  "subtitle": "Short subtitle",
  "category": "Category Name",
  "tags": ["Tag1", "Tag2"],
  "description": "Brief description",
  "longDescription": "Detailed description",
  "technologies": ["Tech1", "Tech2"],
  "github": "https://github.com/...",
  "demo": "https://demo-url.com",
  "caseStudy": "case-studies/case-study-name.html",
  "status": "complete",
  "images": ["path/to/image.jpg"],
  "videos": [],
  "year": "2024",
  "type": "Personal"
}
```

3. The project will automatically appear on the projects page — no rebuild step needed, since the page fetches the JSON directly. (`status: "template"` entries are excluded from the live grid; use that for stubs that aren't written up yet.)

## Creating a Case Study

1. Create a new HTML file in `case-studies/` folder
2. Use an existing case study as a template
3. Update the `caseStudy` field in `projects.json` to point to your new file
4. Link to it from project cards

## Technologies Used

- HTML5
- CSS3 (Custom Properties, Grid, Flexbox)
- Vanilla JavaScript (ES6+)
- JSON for data storage
- Vanilla Tilt.js for card animations

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile devices
- Graceful degradation for older browsers

## View in VR (WebXR)

The **View in VR** button appears in the site header when the browser reports support for `immersive-vr` (typical in Meta Quest Browser).

1. Open the live site over **HTTPS** (required for WebXR), e.g. [rabiatsadiq.com](https://www.rabiatsadiq.com)
2. Tap **View in VR** → **Enter VR** on the VR page
3. You spawn inside the portfolio hero: nebula atmosphere, VR headset, intro copy, featured project cards, and nav pills
4. **Hands:** enable Quest hand tracking to point with your index finger, pinch to select, or grab and release project cards (controllers and mouse also work)

**Local testing:** Serve over HTTPS (`npx local-ssl-proxy` or similar) — `file://` and plain HTTP will not enable WebXR on Quest.

**Desktop without a headset:** Open `vr.html` directly; use mouse-look to preview the 3D layout (Enter VR hidden if WebXR is unavailable).

**Data:** Scene copy and featured projects are defined in [`assets/vr-lobby.json`](assets/vr-lobby.json); layout logic in [`assets/vr-lobby.js`](assets/vr-lobby.js).

## License

Personal portfolio website - All rights reserved.
