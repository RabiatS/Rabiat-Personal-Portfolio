# Rabiat Sadiq — Portfolio

**[rabiatsadiq.com](https://www.rabiatsadiq.com)**

Interactive portfolio for applied ML, XR, and HCI work — built as a static site with no backend required for browsing. If you're here as a recruiter or collaborator, start on the live site; this repo is the source behind it.

## What to explore

| Area | What you'll find |
|------|------------------|
| **Home** | Hero, featured projects, experience timeline, skills |
| **Projects** | Filterable gallery (XR, ML, HCI, research tags) with search |
| **Case studies** | Deep dives on Magic Mitts, PlayStation internship, Spotify research, Assuage ML, XR pain perception |
| **Coursework** | Academic and independent study highlights |
| **Contact** | Get in touch |
| **Cool** | Curated inspiration from other sites |

Resume: linked from the site header and hero CTAs ([PDF](https://www.rabiatsadiq.com/assets/Rabiat_Sadiq_Resume.pdf)).

## Highlights & interactive features

**Core experience**

- **Project gallery** — JSON-driven project cards with tag filters and live search
- **Case studies** — Long-form write-ups for flagship work
- **Responsive layout** — Mobile and desktop; dark mode with system preference + saved choice
- **Accessibility** — ARIA labels, keyboard navigation, reduced-motion support

**Visual & polish**

- **Galaxy canvas** — Animated nebula hero with parallax and shooting stars
- **VR headset eyes** — Cursor-following eyes in the hero
- **Card tilt** — Subtle 3D tilt on project cards (respects reduced motion)
- **Color schemes** — 20+ palettes plus optional plain/recruiter-friendly modes
- **Rainbow mode** — Hidden party theme (hold the theme toggle)
- **Scroll timeline** — Experience section with scroll-driven reveals and cursor-reactive dots

**Builder cube** *(homepage, desktop)*

- A **Three.js** scroll companion: a metallic cube labeled with **HARDWARE**, **SOFTWARE**, **ENGINEER**, **VR**, **AI / ML**, and **RESEARCHER**
- Tracks scroll on the home page, reacts to theme changes, and supports a **click-to-drop** fall animation into the footer (impact + dust, then resets)
- **Builder mode** adds extra scroll polish on launch cards when the cube is active
- Honors `prefers-reduced-motion`; disabled on small screens

**Hidden & coming soon**

- **Signal Lab** — Easter egg on the homepage: type `build` anywhere (not in a text field), triple-tap the scroll cue on mobile, or visit once with `?lab=1`. A particle “lab” overlay — “You found the lab. It does not ship.”
- **Talk to AI me** — Double-click the footer tagline to open a portfolio chat UI; **RAG-powered answers about my work are coming soon** (placeholder conversation today)
- **RAG project** — Listed on the projects page as in-progress exploration of retrieval-augmented LLM pipelines

**WebXR** — **View this site in VR** on the [Cool](https://www.rabiatsadiq.com/cool.html) page (or header on Quest); immersive **A-Frame** lobby of the portfolio hero and featured work

## Tech stack

- HTML5, CSS3 (custom properties, Grid, Flexbox)
- Vanilla JavaScript (ES6+ modules where needed)
- **Three.js** — Builder cube
- **GSAP** — Cube fall animation
- **A-Frame** — WebXR lobby (`vr.html`)
- JSON for project and VR scene data
- Vanilla Tilt.js for card interactions

## Browser support

Modern browsers (Chrome, Firefox, Safari, Edge). WebXR requires HTTPS and a compatible headset or browser; the rest of the site works on mobile without VR.

## License

Personal portfolio — all rights reserved.
