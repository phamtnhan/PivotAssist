"""Guest /jobs network: count /api/jobs vs listing SSR. Uses D:\\Tools Python Playwright."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
api: list[dict[str, str]] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on(
        "request",
        lambda req: api.append({"method": req.method, "url": req.url.replace(base, "")})
        if "/api/" in req.url
        else None,
    )
    response = page.goto(f"{base}/jobs", wait_until="networkidle", timeout=120_000)
    page.wait_for_timeout(1500)
    chrome = page.evaluate(
        """() => ({
          phong: Boolean([...document.querySelectorAll('a')].find(a => /Phòng phỏng vấn|Interview room/i.test(a.textContent || ''))),
          taoPhong: Boolean([...document.querySelectorAll('a,button')].find(el => /Tạo phòng phỏng vấn/i.test(el.textContent || ''))),
          jobHeadings: document.querySelectorAll('h3').length,
          logout: Boolean([...document.querySelectorAll('button')].find(b => /Đăng xuất|Log out/i.test(b.textContent || ''))),
        })"""
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": response.status if response else None,
        "listing_get": [row for row in api if row["url"] == "/api/jobs" or row["url"].startswith("/api/jobs?")],
        "detail_get": [row for row in api if row["url"].startswith("/api/jobs/")],
        "other_api": [row for row in api if not row["url"].startswith("/api/jobs")],
        "all_api": api,
        "chrome": chrome,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    browser.close()
