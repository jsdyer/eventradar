"""Build the static Event Radar app and vendor the pinned calendar parser."""
import base64
import hashlib
import io
from pathlib import Path
import shutil
import tarfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2.2.1"
EXPECTED = "yK/UlPbEs316igb/tjRgbFA8ZV75rCsBJp/hWOatpyaPNlgw0dGDmU+FoicOcwX4xXkeXOkYiOmCqNPFpNPkQg=="
URL = f"https://registry.npmjs.org/ical.js/-/ical.js-{VERSION}.tgz"
request = Request(URL, headers={"User-Agent": "CoolCode Event Radar build (https://coolcode.ca/)"})
with urlopen(request, timeout=45) as response:
    archive = response.read(5_000_001)
if len(archive) > 5_000_000 or base64.b64encode(hashlib.sha512(archive).digest()).decode() != EXPECTED:
    raise RuntimeError("ical.js package failed the pinned integrity check")

destination = ROOT / "dist"
if destination.exists():
    shutil.rmtree(destination)
shutil.copytree(ROOT / "web", destination)
vendor = destination / "vendor"
vendor.mkdir()
with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
    for upstream, local in (("package/dist/ical.min.js", "ical.mjs"), ("package/LICENSE", "ICAL-LICENSE")):
        with bundle.extractfile(upstream) as contents:
            (vendor / local).write_bytes(contents.read())
print(f"Built Event Radar with ical.js {VERSION}.")
