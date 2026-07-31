# Leaderboard reference

## Upload convention

```text
uploads/YYYY-MM-DD/<runner-name>.png
```

## Challenge targets

Optional map in `leaderboard/challenge-targets.json`:

```json
{
  "2026-08-05": 5,
  "2026-08-06": 4
}
```

## Entries input for the helper script

`/tmp/roll-run-entries.json` example:

```json
{
  "challengeTargetKm": 5,
  "entries": [
    {
      "runner": "Alex",
      "distanceKm": 5.2,
      "movingTime": "28:14",
      "activityType": "run",
      "activityDate": "2026-08-05",
      "sourceFile": "alex.png",
      "confidence": "high"
    }
  ],
  "unparsed": [
    {
      "sourceFile": "blurry.jpg",
      "error": "Distance not readable"
    }
  ]
}
```

## Write helper

```bash
python3 .cursor/skills/roll-run-leaderboard/scripts/write_leaderboard.py \
  --date 2026-08-05 \
  --input /tmp/roll-run-entries.json
```

## Output JSON schema

`leaderboard/YYYY-MM-DD.json`:

```json
{
  "date": "2026-08-05",
  "generatedAt": "2026-08-06T08:00:00Z",
  "challengeTargetKm": 5,
  "challengeLabel": "5 km",
  "entries": [
    {
      "rank": 1,
      "runner": "Alex",
      "distanceKm": 5.2,
      "movingTime": "28:14",
      "activityType": "run",
      "activityDate": "2026-08-05",
      "metTarget": true,
      "sourceFile": "alex.png",
      "confidence": "high"
    }
  ],
  "unparsed": []
}
```

## Markdown template

```markdown
# Roll & Run Leaderboard · 2026-08-05

Challenge target: **5 km**

| Rank | Runner | Distance | Time | Target |
| --- | --- | --- | --- | --- |
| 1 | Alex | 5.2 km | 28:14 | Met |

## Needs review
- None
```
