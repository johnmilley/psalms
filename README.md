# The Psalms of David

The complete Coverdale Psalter — all 150 Psalms, 2,508 verses — presented as a
book, in the manner of the Commonwealth edition of *Divine Worship: Daily
Office*.

A static site: open `index.html` in a browser. No build step, no dependencies
beyond a web font fetched from Google Fonts (falls back to Georgia offline).

## The text

The Psalter of Miles Coverdale (1535) as it stands in the 1662 Book of Common
Prayer, with the traditional pointing: each verse is divided for chanting,
marked here with an asterisk as in *Divine Worship: Daily Office*. The
thirty-day monthly cycle of Morning and Evening Prayer is rubricated in red
throughout, and each psalm carries its Latin incipit.

The text was parsed from Lynda Howell's transcription of the 1662 BCP
(`source/psalms_*.html`, from eskimo.com/~lhowell/bcp1662) by
`build/parse.py`, which also repairs nine transcription slips against the
standard 1662 text (see `PATCHES` in that file) and validates psalm and verse
numbering. `psalms.js` is the generated corpus; regenerate it with:

    python3 build/parse.py   # writes build/psalms.json; see end of script

## Reading

- **← / →**, click a page's outer margin, swipe, or scroll — turn the page
- **Shift + ← / →** — turn ten spreads at once
- **drag the page-edge** below the book — riffle through the whole Psalter
- **type a number**, then Enter — go to that psalm
- **T** — the Table; **Home / End** — boards of the book
- `#23` or `?ps=23` in the URL opens the book at Psalm 23; your place is kept
  between visits.
