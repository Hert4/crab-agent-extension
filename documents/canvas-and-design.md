# Canvas & Design

Crab has specialized skills for visual creation — from simple posters to interactive generative art.

---

## Poster & Graphic Design

Ask Crab to create visual designs and it will generate them as downloadable images or documents.

```
Design a minimalist poster for a jazz concert on December 15th
at The Blue Note. Use dark blue and gold colors.
```

```
Create a social media banner for my coffee shop "Bean & Brew"
with a warm, cozy aesthetic
```

```
Make a birthday invitation card for Sarah's 30th birthday party,
theme: tropical vibes
```

### How It Works

1. Crab defines a visual direction (colors, typography, layout)
2. Creates the design as HTML/CSS rendered at the right dimensions
3. Outputs it via the document generator as PDF, DOCX, or inline preview
4. You can download or print the result

### Tips for Better Designs

- **Describe the mood** — "minimal", "bold", "retro", "elegant"
- **Specify colors** if you have preferences — "use navy and coral"
- **Mention the format** — "Instagram square", "A4 poster", "Facebook cover"
- **Include all text** you want on the design

---

## Generative Art

Crab can create interactive algorithmic art using p5.js:

```
Create a generative art piece with flowing particles in blue and purple
```

```
Make an interactive fractal tree that grows when I click
```

```
Generate a Voronoi diagram with pastel colors that responds to mouse movement
```

### What You Get

- Interactive HTML canvas rendered inline in the side panel
- Controls for regenerating with different seeds
- Option to download as PNG
- Supports: particle systems, flow fields, fractals, L-systems, Voronoi patterns, cellular automata

---

## Frontend & Web Design

Ask Crab to design web UIs and it will create functional HTML+CSS:

```
Design a landing page for a fitness app called "FitTrack"
with a hero section, features grid, and pricing table
```

```
Create a dark-mode dashboard layout with a sidebar, header,
and 4 stat cards
```

```
Design a login form with email and password fields,
a "Remember me" checkbox, and social login buttons
```

### Output

Designs render directly in the side panel as interactive previews. You can view the source code and use it in your own projects.

---

## Working with Canvas Apps

Crab can interact with design tools that use canvas rendering (no traditional DOM):

| App | What Crab Can Do |
|-----|-----------------|
| **Figma** | Draw shapes, add text, create frames, use shortcuts (R, T, F) |
| **Miro** | Add sticky notes, draw shapes, create diagrams |
| **Excalidraw** | Draw rectangles, arrows, text, lines using keyboard shortcuts |
| **Google Docs/Slides** | Type content, format text, insert elements |
| **Canva** | Navigate templates, add elements, edit text |

### Example

```
Open Figma and create a wireframe with a header, sidebar, and main content area
```

```
Go to Excalidraw and draw a flowchart:
Start → Process Data → Decision (Yes/No) → End
```

### How It Works

For canvas apps, Crab uses a different approach:

1. **Screenshot analysis** — Takes a picture to understand the UI layout
2. **Coordinate-based actions** — Clicks toolbar buttons and drags on the canvas using pixel coordinates
3. **Smart paste** — For complex content (tables, flowcharts, SVGs), Crab generates the content and pastes it directly

---

## Document Generation

Crab can create downloadable documents:

```
Create a PDF report titled "Q4 Sales Summary" with the data from this page
```

```
Generate a Word document with a cover page, table of contents,
and 3 sections about our product features
```

```
Make an HTML page with a responsive portfolio layout
```

### Supported Formats

| Format | How to Download |
|--------|----------------|
| **PDF** | Opens in a new tab — use browser's Print → Save as PDF |
| **DOCX** | Direct download as .docx file |
| **HTML** | Direct download or inline preview |

---

## Charts & Visualizations

Crab can render data visualizations inline:

```
Create a bar chart showing monthly revenue:
Jan: $12k, Feb: $15k, Mar: $18k, Apr: $14k, May: $22k
```

```
Make a pie chart of browser market share:
Chrome 65%, Safari 18%, Firefox 8%, Edge 5%, Other 4%
```

Charts render as SVG or interactive HTML directly in the chat.
