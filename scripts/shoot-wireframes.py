"""Screenshot each `-wireframe.html` into the `-wire-thumb.webp` the gallery shows.

Run after scripts/build-wireframes.mjs:

    python scripts/shoot-wireframes.py            # only missing thumbnails
    python scripts/shoot-wireframes.py --force    # redo everything
    python scripts/shoot-wireframes.py hero-v1    # just these slugs

Needs Playwright's chromium (`python -m playwright install chromium`). Kept as a
script rather than a build step because these are committed assets: the gallery
must render them without a browser, a network call, or an API key.
"""

import glob
import io
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIVATE = os.path.join(ROOT, "public", "private")

# 16:10 exactly, because the gallery card renders `aspect-[16/10] object-cover`.
# Shot at any other ratio the card crops the sides off, which eats the first and
# last character of every heading — observed at 1280x640.
VIEWPORT = {"width": 1280, "height": 800}


def targets(argv):
    only = {a for a in argv if not a.startswith("--")}
    for path in sorted(glob.glob(os.path.join(PRIVATE, "*-wireframe.html"))):
        slug = os.path.basename(path).replace("-wireframe.html", "")
        if only and slug not in only:
            continue
        yield slug, path


def main():
    force = "--force" in sys.argv
    todo = list(targets(sys.argv[1:]))
    if not todo:
        print("nothing to shoot — run scripts/build-wireframes.mjs first")
        return

    done = skipped = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=2)
        for slug, path in todo:
            out = os.path.join(PRIVATE, f"{slug}-wire-thumb.webp")
            if not force and os.path.exists(out):
                skipped += 1
                continue
            page.goto("file:///" + path.replace("\\", "/"))
            # Sections animate in on scroll; without settling, a thumbnail can
            # capture the section mid-fade and look broken.
            page.wait_for_timeout(1200)
            # Playwright writes png/jpeg only, so the webp the gallery expects is
            # a second step rather than a screenshot option.
            png = page.screenshot(type="png")
            Image.open(io.BytesIO(png)).convert("RGB").save(out, "WEBP", quality=82, method=6)
            done += 1
            print(f"  {slug}")
        browser.close()

    print(f"\nshot {done}, skipped {skipped}")


if __name__ == "__main__":
    main()
