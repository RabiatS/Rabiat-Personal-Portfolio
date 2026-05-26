# Rabiat Sadiq Portfolio Website
>>>> [Website](https://www.rabiatsadiq.com)


A comprehensive, interactive portfolio website showcasing my interdisciplinary work in Applied ML, XR, and Human-Computer Interaction.

## File Structure

```
Personal webpage/
├── index.html              # Home page with hero, featured projects, timeline
├── vr.html                 # WebXR immersive view (inside the site hero + featured work)
├── projects.html           # Comprehensive projects page with filtering
├── coursework.html         # Coursework showcase page
├── contact.html            # Contact form page
├── cool.html               # Cool websites collection
│
├── case-studies/           # Detailed case study pages
│   ├── case-study.html            # Magic Mitts haptic VR glove
│   ├── case-study-ps.html         # PlayStation internship
│   ├── case-study-spotify.html   # Spotify vs AI research
│   ├── case-study-assuage.html    # Assuage health ML
│   └── case-study-pain-xr.html    # XR pain perception (CMU)
│
├── assets/                 # Static assets
│   ├── style.css           # Main stylesheet
│   ├── script.js           # JavaScript functionality
│   ├── projects.json       # Project data (easy to update!)
│   ├── favicon.svg         # Site favicon
│   ├── mm.png              # Magic Mitts image
│   ├── HCI_Proposal_for_Independent_Study_Rabiat_XR.pdf
│   ├── Rabiat_Sadiq_Resume.pdf    # Resume PDF
│   └── img/                # Image assets
│       ├── projects/       # Project-specific images
│       └── placeholders/   # Placeholder images
│
└── files/                  # Documents and other files
    └── Rabiat_Sadiq_Resume_DEC_2025.pdf
```

## Features

- **Dynamic Project Loading**: Projects are loaded from embedded JSON data (no server required)
- **Interactive Filtering**: Filter projects by tags (XR, ML, HCI, Research, etc.) with real-time updates
- **Search Functionality**: Real-time search across project titles and descriptions
- **Case Studies**: Detailed case study pages for major projects with rich content
- **Responsive Design**: Fully responsive layout that works seamlessly on mobile and desktop
- **Dark Mode**: Theme toggle with system preference detection and localStorage persistence
- **Secret Rainbow Mode**: Hidden party mode activated by holding the theme toggle button
- **Interactive Galaxy Canvas**: Animated nebula background with parallax effect and shooting stars
- **VR Eye Animation**: Interactive VR headset with eyes that follow cursor movement
- **View in VR (WebXR)**: On supported headsets (Quest Browser, etc.), a header link opens [`vr.html`](vr.html) — an immersive 3D version of the home hero and featured projects (A-Frame)
- **Card Tilt Effects**: 3D tilt animations on project cards (configurable: off, desktop-only, or all devices)
- **Color Scheme Switcher**: 20+ fun color schemes to customize the site's appearance
- **Smooth Animations**: CSS transitions and JavaScript-powered animations throughout
- **Accessibility**: ARIA labels, keyboard navigation, and reduced motion support

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

3. The project will automatically appear on the projects page!

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

**Local testing:** Serve over HTTPS (`npx local-ssl-proxy` or similar) — `file://` and plain HTTP will not enable WebXR on Quest.

**Desktop without a headset:** Open `vr.html` directly; use mouse-look to preview the 3D layout (Enter VR hidden if WebXR is unavailable).

**Data:** Scene copy and featured projects are defined in [`assets/vr-lobby.json`](assets/vr-lobby.json); layout logic in [`assets/vr-lobby.js`](assets/vr-lobby.js).

## License

Personal portfolio website - All rights reserved.
