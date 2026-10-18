# Project: ProtegeDNI Mobile-First Guided Wizard Refactoring

## Architecture
ProtegeDNI is a 100% client-side privacy application that redacts sensitive personal data on Spanish National Identity Cards (DNI). The architecture is transitioning from a monolithic multi-card dashboard into a sequential, single-focus, mobile-first guided wizard:

```
[ Step 1.1: Add Front ] ──► [ Step 1.2: Mark Corners & Rotate ] ──► [ Step 1.3: Anonymize Front ]
                                                                                │
┌───────────────────────────────────────────────────────────────────────────────┘
▼
[ Step 2.1: Add Back (or Skip) ] ──► [ Step 2.2: Mark Corners & Rotate ] ──► [ Step 2.3: Anonymize Back ]
                                                                                            │
┌───────────────────────────────────────────────────────────────────────────────────────────┘
▼
[ Step Final: Purpose Watermark & Export ] ──► [ Download PNG/JPG ] | [ Copy for WhatsApp / Web Share ]
```

### Key Architectural Tenets:
1. **Single-Focus Wizard UI**: Only one active step is visible at a time (`.wizard-step:not(.active) { display: none; }`). A sticky progress indicator at the top and thumb-reachable "Atrás" / "Siguiente" navigation buttons at the bottom guide the user seamlessly through the flow on mobile screens.
2. **Safe Defaults by Design (No Advanced Clutter)**: Advanced mode toggle, sliders for contrast, brightness, pixelation intensity, and watermark styling are eliminated. The app permanently applies safe, compliant defaults:
   - Pixelation redaction (intensity 18).
   - Perceptual B&W conversion (ITU-R BT.601 formula with fixed 1.15 contrast).
   - Diagonal repeating tiled watermark at -28° with localized current date.
3. **100% On-Device Privacy**: All image manipulation runs strictly in memory via HTML5 Canvas and `toBlob` / `toDataURL`. No server uploads; EXIF metadata, camera tags, and GPS coordinates are stripped automatically on export.
4. **Resilient Sharing**: "Copiar para WhatsApp" uses a 3-tier cascade: Web Share API (`navigator.share({ files: [pngFile] })`) -> Async Clipboard API (`navigator.clipboard.write`) -> Direct download fallback.

## Code Layout
- `index.html`: Main single-page application structure, wizard step containers (`#step-1-1` through `#step-final`), top step progress indicator, bottom navigation bar, preset chip containers, info modal (`#guide-modal`). All deprecated advanced mode containers removed.
- `app.js`: Application core logic, state management (`wizardStep`, `currentSide`, `frontState`, `backState`, `exportSettings`), canvas rendering, corner calibration math, preset definitions and toggling, pointer event handling for touch drawing/resizing, and export/sharing pipeline.
- `styles.css`: Mobile-first responsive styles, single-step wizard display rules (`.wizard-step:not(.active) { display: none; }`), 44px+ touch targets, sticky navigation bar, preset chip styling, canvas container, and modal dialogs.
- `Spanish_ID_card_(front_side).webp`: Real specimen front image for 1-click demo testing.
- `back.jpg`: Real specimen back image for 1-click demo testing.
- `firebase.json` & `.firebaserc`: Firebase Hosting configuration pointing to project `dni-blur`.
- `tests/e2e/`: Automated browser verification suite using Puppeteer.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Single-step wizard container & progress bar | Display only one step at a time; show clear step progress indicator (Steps 1.1-1.3, 2.1-2.3, Final) | M1 | ORIGINAL_REQUEST §R1.1-R1.3 |
| 2 | Mobile thumb navigation bar | "Atrás" and "Siguiente" buttons at bottom of screen, accessible within thumb reach | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Remove Advanced Mode & Sliders | Remove Simple/Advanced toggle, redaction style selector, intensity slider, B&W contrast/brightness sliders, watermark sliders | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Step 1.1 Add Front Side | Upload front photo or pick built-in demo image (`Spanish_ID_card_(front_side).webp`) | M1 | ORIGINAL_REQUEST §R1.1 |
| 5 | Step 1.2 Front Corners & Rotation | 90° step rotation, fine straightening slider (-15° to +15°), 2-point corner marking calibration | M1 | ORIGINAL_REQUEST §R1.1 |
| 6 | Step 1.3 Front Presets & Touch Adjust | 6 front preset chips with active indicators, AEPD recommendations, manual touch box draw/drag/resize/delete | M1 | ORIGINAL_REQUEST §R1.1 |
| 7 | Sensitive Field Info Explanations | Accessible info modals/triggers explaining what each field is and why it must be anonymized | M1 | ORIGINAL_REQUEST §R1.1 |
| 8 | Step 2.1 Add Back Side & Skip Option | Upload back photo, pick demo (`back.jpg`), or optionally skip back side | M1 | ORIGINAL_REQUEST §R1.2 |
| 9 | Step 2.2 Back Corners & Rotation | 90° step rotation, fine straightening slider, 2-point corner marking calibration for back card | M1 | ORIGINAL_REQUEST §R1.2 |
| 10 | Step 2.3 Back Presets & Touch Adjust | 4 back presets (MRZ, Domicilio, Padres, Lugar de Nacimiento) with toggle and touch box adjust | M1 | ORIGINAL_REQUEST §R1.2 |
| 11 | Step Final Watermark Configuration | Purpose text input with quick preset chips (Alquiler, Hotel, Trabajo, Banco) and current date | M1 | ORIGINAL_REQUEST §R1.3 |
| 12 | Safe Defaults Auto-Application | Auto-apply perceptual B&W, pixelation redaction, and diagonal repeating watermark with date | M1 | ORIGINAL_REQUEST §R2 |
| 13 | Final Unified Document Rendering | Render Front + Back unified onto a single composite document (or front-only if back skipped) | M1 | ORIGINAL_REQUEST §R1.3 |
| 14 | Final Export Actions (Download & WhatsApp) | "Descargar imagen" (JPG/PNG) and "Copiar para WhatsApp" (Web Share API + Clipboard + Fallback) | M1 | ORIGINAL_REQUEST §R1.3 |
| 15 | 100% On-Device Client Privacy | Ensure zero network uploads and automatic EXIF/GPS stripping via canvas raster re-encoding | M1 | ORIGINAL_REQUEST §R3 |
| 16 | E2E Browser Automated Test Suite | Puppeteer automated browser test suite verifying all steps and operations with zero console errors | M2 | ORIGINAL_REQUEST §R3 |
| 17 | Git Commit & Push | Commit clean changes and push to `origin/main` (`https://github.com/GabrielRullan/dni-blur`) | M2 | ORIGINAL_REQUEST §R3 |
| 18 | Firebase Hosting Deployment | Deploy application to Firebase Hosting (`dni-blur` project) | M2 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Guided Wizard & Engine Refactoring | Steps 1.1-1.3, 2.1-2.3, Final Export, remove advanced mode & sliders, safe defaults, Web Share | none | DONE |
| M2 | Automated E2E Verification, Git Push & Firebase Deploy | Puppeteer test suite, zero console errors, origin/main push, Firebase hosting deployment | M1 | DONE |

## Interface Contracts
### Wizard State & Navigation (`app.js`)
- `state.wizardStep`: string (`'step-1-1'`, `'step-1-2'`, `'step-1-3'`, `'step-2-1'`, `'step-2-2'`, `'step-2-3'`, `'step-final'`).
- `goToStep(stepId)`: validates prerequisites, sets active step, updates top progress bar, toggles bottom navigation visibility, and triggers appropriate canvas re-render.
- `state.sides.front` & `state.sides.back`:
  ```javascript
  {
    image: HTMLImageElement | null,
    imgOrientation: 0 | 90 | 180 | 270,
    fineRotation: number, // -15 to +15
    calibration: { topLeft: {x, y} | null, bottomRight: {x, y} | null },
    boxes: Array<{ id, x, y, width, height, presetKey, style }>,
    skipped: boolean
  }
  ```
- `state.exportSettings`:
  ```javascript
  {
    watermarkText: string,
    watermarkDate: string, // auto-populated with formatted Spanish date
    format: 'png' | 'jpeg',
    quality: 0.92
  }
  ```

### Redaction & Canvas Rendering Engine
- `renderCurrentStepCanvas()`: Renders active card image with rotation, corner pins (if in step 1.2/2.2), and active redaction boxes (if in step 1.3/2.3).
- `renderMergedDocument(forExport)`: Composites front and back (or front-only if back skipped) onto high-resolution document canvas, applying perceptual B&W, pixelation, and diagonal watermark.

### Sharing & Export Pipeline
- `downloadProtectedImage(format)`: Generates data URL or blob and triggers browser download.
- `shareOrCopyForWhatsApp()`:
  1. Checks `navigator.canShare && navigator.canShare({ files: [file] })` -> triggers `navigator.share`.
  2. Else checks `navigator.clipboard && navigator.clipboard.write` -> writes `ClipboardItem` with PNG blob.
  3. Else falls back to `downloadProtectedImage('png')` with informative user toast.
