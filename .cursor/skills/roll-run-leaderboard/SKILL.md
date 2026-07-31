---
name: roll-run-leaderboard
description: >-
  Processes Roll & Run Challenge Strava screenshots for a challenge day by
  reading images in the agent, extracting run data visually, and writing ranked
  leaderboard JSON and Markdown. Use when the user asks to build the
  leaderboard, OCR uploads, process yesterday's runs, score Strava screenshots,
  or update August challenge standings.
---

# Roll & Run Leaderboard

Daily workflow for the Kurtosys August 2026 Roll & Run Challenge.

OCR is done by the agent: open each screenshot with the Read tool and extract
the values yourself. Do not call Gemini or any external OCR API.

## When to use

- "Build yesterday's leaderboard"
- "OCR the Strava uploads"
- "Process today's/yesterday's run screenshots"
- "Update the challenge standings"

## Preconditions

1. Screenshots live in `uploads/YYYY-MM-DD/` as `.png`, `.jpg`, `.jpeg`, or `.webp`
2. Filenames should include the runner name when possible, e.g. `jason-renaud.png`
3. Working directory is the DiceChallenge repo root

If uploads are missing, stop and tell the user which folder to populate.

## Workflow

Copy and track:

```text
Leaderboard Progress:
- [ ] 1. Resolve challenge day (default: yesterday in local timezone)
- [ ] 2. List images in uploads/<date>/
- [ ] 3. Read each image and extract run data
- [ ] 4. Compare distances to the day's challenge target when known
- [ ] 5. Write leaderboard JSON and Markdown
- [ ] 6. Summarize standings for the user
```

### 1. Resolve the day

Default date is **yesterday**.

Override if the user names a date. Use `YYYY-MM-DD`.

### 2. Collect uploads

Expected path:

```text
uploads/2026-08-05/
  alex.png
  sam-strava.jpg
```

If the folder is empty, do not invent runners.

### 3. Agent OCR

For each image:

1. Use the Read tool on the image path
2. Extract:
   - runner name (from screenshot if visible, else filename)
   - distance km
   - moving time
   - activity date if shown
   - activity type (run / walk / jog)
   - confidence: high / medium / low
3. If distance is unreadable, add the file to `unparsed`

Do not call external APIs for OCR.

Optional helper to scaffold output files after you have the extracted rows:

```bash
python3 .cursor/skills/roll-run-leaderboard/scripts/write_leaderboard.py \
  --date YYYY-MM-DD \
  --input /tmp/roll-run-entries.json
```

You may also write the JSON and Markdown files directly.

### 4. Ranking rules

Rank completed runs by:

1. Distance completed relative to the day's assigned challenge (met target first)
2. Then higher recorded distance
3. Then earlier finish time if present
4. Pending / failed OCR entries listed separately under Needs review

Rest days: do not rank. Write a short rest-day note instead.

Challenge targets, when known, live in `leaderboard/challenge-targets.json`.

### 5. Output files

Write:

- `leaderboard/YYYY-MM-DD.json`
- `leaderboard/YYYY-MM-DD.md`
- `leaderboard/latest.md`

### 6. Output to the user

Return:

- Path to the markdown leaderboard
- Top 3 finishers
- Any OCR failures that need manual review

## Manual fallback

If a screenshot is unreadable:

1. Leave the runner in Needs review
2. Ask the user for distance km
3. Update the leaderboard with the confirmed value

## Additional resources

- JSON and Markdown schemas: [reference.md](reference.md)
