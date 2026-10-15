#!/usr/bin/env python3
"""Put the Cloudflare Web Analytics beacon on every page.

Usage: python3 tools/add_analytics.py <token>

The token comes from the Cloudflare dashboard (Analytics & Logs, Web
Analytics, Add a site, "I don't use Cloudflare for this site"). The beacon
is cookieless, so no consent banner is needed. Running it again with a
different token replaces the tag; the same token is a no-op.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAG = ('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" '
       'data-cf-beacon=\'{"token": "%s"}\'></script>\n')
EXISTING = re.compile(r'<script[^>]*static\.cloudflareinsights\.com[^>]*></script>\n')


def main(token: str) -> None:
    tag = TAG % token
    changed = 0
    for page in sorted(ROOT.rglob("*.html")):
        if ".git" in page.parts:
            continue
        text = page.read_text()
        stripped = EXISTING.sub("", text)
        if "</body>" not in stripped:
            print(f"skip (no </body>): {page.relative_to(ROOT)}")
            continue
        new = stripped.replace("</body>", tag + "</body>", 1)
        if new != text:
            page.write_text(new)
            changed += 1
    print(f"{changed} page(s) updated")


if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        sys.exit(__doc__)
    main(sys.argv[1].strip())
