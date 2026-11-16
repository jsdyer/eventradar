# Event Radar

Discover upcoming Metro Vancouver and Halifax events from [Has Things](https://hasthings.com/), or open the source venue calendars for Vancouver, Langley, and Halifax. Listings can arrive with an unknown clock time, cancellation, postponement, or sellout. Verify details and availability with the organizer.

Data: Has Things (hasthings.com), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The [Vancouver](https://vancouver.hasthings.com/feeds/events.json) and [Halifax](https://halifax.hasthings.com/feeds) feeds are read live from the browser. Feed listing metadata and any exported selection retain source attribution. Weather and artwork are omitted. Langley coverage consists of linked venue pages and calendar files you provide. No automated retrieval is performed from the linked venue calendars.

Import an .ics file to search events locally. Plans and imports stay in memory until you reload or leave. Download a selection as a portable .ics file. The app handles date-only entries, UTC and local dates, registered VTIMEZONE definitions, and common recurrence rules inside a bounded window. Unresolved floating times use the selected fallback zone. Calendar notices for Langley and Vancouver may require checking against the registration confirmation around timezone rule changes.

Builds pull the pinned [ical.js](https://github.com/kewisch/ical.js/tree/v2.2.1) parser from npm, verify SHA-512, and deliver it from the same origin under MPL 2.0.

```sh
python3 scripts/build.py
python3 -m http.server --directory dist 8000
```
