# TODO: jonathanpoeder.com

## Now

- 🧑 Decide whether to restyle the hero after the Vesper particle cloud (dark navy and cyan, or the same particle system in the current light and orange scheme). Teardown: `docs/vesper-motion-reference.md`.
- 🤖 Add each JHU EN.705.603 case study to Projects, Johns Hopkins case studies, once it is graded: IronClad (due 2026-10-25), TextWave, MovieMate, SecureBank final project. Pattern: `projects/case-studies/techtrack/`. Own findings only; no course materials, code, or links to private repos.

## Next

- 🧑 Decide whether to remove the leftover `projects/1_project` to `3_project` template pages (another author's placeholder content).

## Done

- 🤖 2026-10-15: Light and dark theme toggle in the nav on every page. Follows the OS preference until clicked, remembers the choice in the browser, no flash on load, charts and the explorer re-coloured through CSS tokens.
- 🤖 2026-10-15: Cloudflare Web Analytics on every page (5280729). Site `jonathanpoeder.com` under the i8l Cloudflare account, JS snippet install, cookieless. Dashboard: Analytics & Logs, Web analytics; it also lands in the i8l portal hosts panel. New pages get the tag from `python3 tools/add_analytics.py <token>` (token is in any page's source).
- 🤖 2026-10-15: Downloadable resume (`assets/pdf/Jonathan-Poeder-Resume.pdf`, from the 2026-09-17 PDF) linked in the nav and contact section on every page (d32422f). To update it, replace that file and push.
- 🤖 2026-10-11: TechTrack case study page and card (a7061f3).
