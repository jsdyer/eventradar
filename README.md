# Event Radar

<!-- coolcode:guide -->
Choose a city to see the next two weeks of shows and community events. Filter by title, venue or date and add showtimes from several cities to one calendar. Download your plans before leaving the tab and check unlisted times or availability with the organizer.
<!-- /coolcode:guide -->

[Browse upcoming events in Halifax](https://coolcode.ca/eventradar/?city=halifax).

Browse upcoming events in 37 Canadian cities across all ten provinces and three territories using [Has Things](https://hasthings.com/) city feeds. Choose a city grouped by province or territory, filter its showtimes, then add selections from several cities to one calendar. A URL such as [St. John’s](https://coolcode.ca/eventradar/?city=st-johns) opens its city directly. Langley has a venue-calendar directory. Listings can arrive with an unknown clock time, cancellation, postponement, or sellout. Verify details and availability with the organizer.

Data: Has Things (hasthings.com), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The browser requests only the selected city's JSON feed. Feed timestamps, window length and truncation come from the response. The default feeds can end early when 1,000 showtimes are reached. Counts and available dates vary by city. [Feed limits and licence](https://halifax.hasthings.com/feeds). Feed listing metadata and any exported selection retain source attribution. Weather and artwork are omitted. Langley coverage consists of linked venue pages and calendar files you provide. No automated retrieval is performed from the linked venue calendars.

## Coverage

| Province or territory | Live city feeds |
|---|---|
| British Columbia | Kamloops, Kelowna, Metro Vancouver, Nanaimo, Victoria |
| Alberta | Calgary, Edmonton, Lethbridge, Medicine Hat, Red Deer |
| Saskatchewan | Regina, Saskatoon |
| Manitoba | Winnipeg |
| Ontario | Barrie, Guelph, Hamilton, Kingston, Kitchener-Waterloo, London, Niagara, Ottawa, Peterborough, Sudbury, Thunder Bay, Toronto, Windsor |
| Quebec | Montréal, Québec, Sherbrooke |
| New Brunswick | Fredericton, Moncton |
| Nova Scotia | Halifax |
| Prince Edward Island | Charlottetown |
| Newfoundland and Labrador | St. John’s |
| Yukon | Whitehorse |
| Northwest Territories | Yellowknife |
| Nunavut | Iqaluit |

On November 19, 2026 all 37 listed city feeds returned nonempty event data with the matching Canadian city and a browser CORS header. Coverage includes each city's published venues and varies across the country. The selected city's local timezone applies to showtimes and is offered as the default for imported floating times. Registered calendar timezones take precedence. For source changes, update the city registry in `web/regions.mjs` and verify the city slug, timezone, Canadian country code and feed headers.

Import an .ics file to search events locally. Plans and imports stay in memory until you reload or leave. Download a selection as a portable .ics file. The app handles date-only entries, UTC and local dates, registered VTIMEZONE definitions, and common recurrence rules inside a bounded window. Unresolved floating times use the selected fallback zone. Calendar notices for Langley and Vancouver may require checking against the registration confirmation around timezone rule changes.

Builds pull the pinned [ical.js](https://github.com/kewisch/ical.js/tree/v2.2.1) parser from npm, verify SHA-512, and deliver it from the same origin under MPL 2.0.

```sh
python3 scripts/build.py
python3 -m http.server --directory dist 8000
```

## Regression checks

Pull requests that change code run logic tests and Chromium checks at this tool’s
Pages subpath, including a real control interaction and 320/390-pixel layouts.
Documentation-only pull requests skip this workflow. Publication waits for the
same checks. Test data stays in a separate job and is never packaged for Pages.

```sh
node --test tests/*.test.mjs
python3 scripts/build.py
python3 -m pip install -r tests/browser-requirements.txt
python3 -m playwright install chromium
python3 tests/browser_smoke.py
```
