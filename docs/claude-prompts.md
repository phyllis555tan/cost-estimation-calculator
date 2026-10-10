# Claude prompts for the estimator

Paste these into a Claude chat (inside your ODD STUDIO project, so it knows your business).

## 1. Turn my old quotations into a rate table

```
Here are some of my past quotations (pasted below). Extract a rate table
for the estimator: one row per type of work, with the unit, and an RM
rate for Basic, Standard and Premium finish levels.

Rules:
- Use only prices that appear in my quotations. Never invent a price.
- If a work item has only one price, put it in Standard and leave Basic
  and Premium as "needs input".
- Show which quotation each rate came from and its date.
- Output a table first so I can check it, then the same data as a
  JavaScript array in this format:
  { id: "tile", name: "Floor tiling (supply and lay)", unit: "sqft", r: [12, 20, 35] }
```

## 2. Step 6 (planned): read a plan, 3D image or site photo

```
I'm sending a floor plan, 3D images or site photos. List each room with:
name, approximate length and width in feet, any dimensions printed on
the plan, and finish cues you can see (flooring, ceiling, feature wall,
cabinets). Mark every value as "read from plan", "measured from
scale" or "guess". Do not guess silently. Ask me for a known dimension
if the scale is unclear. Output a table first, then JSON.
```

The JSON import for step 6 is not built yet.
