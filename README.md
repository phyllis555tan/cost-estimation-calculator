# ODD STUDIO Cost Estimator

A browser tool for ODD STUDIO (interior design and build, Penang) to turn a plan, a furniture layout and a mood board into a ballpark cost, fast enough to use at the client meeting.

No install and no build step. Open `index.html` in a browser.

## Status

| Step | What it does | Status |
|---|---|---|
| 1 | Plan (PDF/JPEG) to drawing | **working**: upload, set scale from one known length, trace walls, mark rooms (sqm and sqft), export DXF |
| 2 | Conceptual furniture layout (DXF) | **working**: furniture library at real size, drag, rotate, duplicate, custom sizes, 50 mm snap, export DXF |
| 3 | Final layout and mood board | **working**: lock the layout, finish level and mood board images per room, furniture per room, print, project export/import |
| 4 | Cost estimate, exports to Excel | **working (v0)**: room-by-room quantities, three finish levels, contingency, +/-10% range, budget check, print, CSV |
| 5 | Value engineering when over budget | planned |
| 6 | Instant estimate from dimension plan, 3D images or site photos | planned (Claude prompt in `docs/claude-prompts.md`) |

## Honest limits

- **Rates are placeholders.** `data/rates.js` holds starter numbers, not ODD STUDIO's real prices. The app shows a warning until you confirm you have entered your own rates. Use the prompt in `docs/claude-prompts.md` to build a rate table from your past quotations.
- **DWG is a closed Autodesk format.** Drawings will be exported as DXF. AutoCAD opens a DXF and saves it as DWG.
- **Converting a plan image to clean CAD lines is not reliable.** Step 1 will be a semi-manual trace over the plan at a known scale.
- **A browser page can't look at images by itself.** Step 6 uses a Claude chat prompt that returns data the app imports.
- Estimates are ballpark only. A final quotation follows once the design is confirmed.

## How to use steps 1 to 3

1. **Plan:** upload the plan. Click **Set scale**, click both ends of a wall or door you know the real length of, type that length, then **Apply scale**. Use **Trace wall** and **Mark room**.
2. **Layout:** pick furniture from the library and drag it into place. R rotates, Delete removes.
3. **Final:** **Lock final layout** when the client agrees, choose a finish level, and add mood board images for each room.
4. **Export DXF** from any of the three tabs. Units are millimetres. Open it in AutoCAD, check the scale, then Save As DWG.

## Tested and not tested

Tested in a browser: scale calibration (a known 8 m guess corrected to 6 m gave exactly 27.0 sqm), wall tracing, room area, furniture drag/snap/rotate, locking, mood images, saving and reloading, and the DXF file structure (rotated furniture dimensions checked in a script).

**Not tested yet:** opening the DXF in AutoCAD, PDF upload (needs internet for the PDF reader), touch screens and phones.

## Files

```
index.html        the app
css/app.css       styles
js/estimate.js    cost logic (step 4)
js/board.js       drawing board: scale, walls, rooms, furniture
js/dxf.js         DXF writer
js/ui.js          tabs, furniture library, Final tab
data/rates.js     starter rate table (edit this or use the Rate table in the app)
data/furniture.js standard furniture sizes in mm
docs/             Claude prompts
```
