# ODD STUDIO Cost Estimator

A browser tool for ODD STUDIO (interior design and build, Penang) to turn a plan, a furniture layout and a mood board into a ballpark cost, fast enough to use at the client meeting.

No install and no build step. Open `index.html` in a browser.

## Status

| Step | What it does | Status |
|---|---|---|
| 1 | Plan (PDF/JPEG) to drawing | planned |
| 2 | Conceptual furniture layout (DXF) | planned |
| 3 | Final layout and mood board | planned |
| 4 | Cost estimate, exports to Excel | **working (v0)**: room-by-room quantities, three finish levels, contingency, +/-10% range, budget check, print, CSV |
| 5 | Value engineering when over budget | planned |
| 6 | Instant estimate from dimension plan, 3D images or site photos | planned (Claude prompt in `docs/claude-prompts.md`) |

## Honest limits

- **Rates are placeholders.** `data/rates.js` holds starter numbers, not ODD STUDIO's real prices. The app shows a warning until you confirm you have entered your own rates. Use the prompt in `docs/claude-prompts.md` to build a rate table from your past quotations.
- **DWG is a closed Autodesk format.** Drawings will be exported as DXF. AutoCAD opens a DXF and saves it as DWG.
- **Converting a plan image to clean CAD lines is not reliable.** Step 1 will be a semi-manual trace over the plan at a known scale.
- **A browser page can't look at images by itself.** Step 6 uses a Claude chat prompt that returns data the app imports.
- Estimates are ballpark only. A final quotation follows once the design is confirmed.

## Files

```
index.html        the app
css/app.css       styles
js/estimate.js    cost logic
data/rates.js     starter rate table (edit this or use the Rate table in the app)
docs/             Claude prompts
```
