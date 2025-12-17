# Rabiat Sadiq Portfolio Website

A comprehensive, interactive portfolio website showcasing my interdisciplinary work in Applied ML, XR, and Human-Computer Interaction.

## File Structure

```
Personal webpage/
├── index.html              # Home page with hero, featured projects, timeline
├── projects.html           # Comprehensive projects page with filtering
├── contact.html           # Contact form page
├── cool.html              # Cool websites collection
│
├── case-studies/          # Detailed case study pages
│   ├── case-study.html           # Magic Mitts haptic VR glove
│   ├── case-study-ps.html        # PlayStation internship
│   ├── case-study-spotify.html   # Spotify vs AI research
│   ├── case-study-assuage.html   # Assuage health ML
│   └── case-study-pain-xr.html   # XR pain perception (CMU)
│
├── assets/                # Static assets
│   ├── style.css          # Main stylesheet
│   ├── script.js          # JavaScript functionality
│   ├── projects.json      # Project data (easy to update!)
│   ├── mm.png             # Magic Mitts image
│   ├── HCI_Proposal_for_Independent_Study_Rabiat_XR.pdf
│   └── img/               # Image assets
│       ├── projects/      # Project-specific images
│       └── placeholders/  # Placeholder images
│
└── files/                 # Documents and other files
    └── Rabiat_Sadiq_Resume_DEC_2025.pdf
```

## Features

- **Dynamic Project Loading**: Projects are loaded from `assets/projects.json`
- **Interactive Filtering**: Filter projects by tags (XR, ML, HCI, Research, etc.)
- **Search Functionality**: Real-time search across project titles and descriptions
- **Case Studies**: Detailed case study pages for major projects
- **Responsive Design**: Works on mobile and desktop
- **Dark Mode**: Theme toggle with system preference detection
- **Interactive Animations**: Galaxy hero animation, card tilt effects, smooth transitions

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

## License

Personal portfolio website - All rights reserved.
