# TODO: jonathanpoeder.com

## Now

- 🤖 Add each JHU EN.705.603 case study to Projects, Johns Hopkins case studies, once it is graded: IronClad (due 2026-10-25), TextWave, MovieMate, SecureBank final project. Pattern: `projects/case-studies/techtrack/`. Own findings only; no course materials, code, or links to private repos.

## Next

- 🤖 Palette follow-ups if wanted: a bloom pass on the hero, or the galaxy and brain shapes from the reference for other sections.
- 🧑 Decide whether to remove the leftover `projects/1_project` to `3_project` template pages (another author's placeholder content).

## Done

- 🤖 2026-10-16: Light/dark toggle restored with an ice-blue light variant of the palette (navy is the default; only an explicit choice switches). Footer wireframes replaced by small particle clouds; particle ramps shifted toward blue `#3f7fcc`, mint kept for the tips.
- 🤖 2026-10-16: Navy and cyan palette site-wide, particle cloud hero (`assets/js/cloud.js`), JP favicon, charts, thumbnail and icons recolored, light/dark toggle removed (a360ab2). Teardown in `docs/vesper-motion-reference.md`; review page stays at `/labs/particle-cloud/`. The previous light and orange styling is on branch `style-light-orange` and tag `style-light-orange-2026-10-16`.
- 🤖 2026-10-15: Light and dark theme toggle in the nav on every page. Follows the OS preference until clicked, remembers the choice in the browser, no flash on load, charts and the explorer re-coloured through CSS tokens.
- 🤖 2026-10-15: Cloudflare Web Analytics on every page (5280729). Site `jonathanpoeder.com` under the i8l Cloudflare account, JS snippet install, cookieless. Dashboard: Analytics & Logs, Web analytics; it also lands in the i8l portal hosts panel. New pages get the tag from `python3 tools/add_analytics.py <token>` (token is in any page's source).
- 🤖 2026-10-15: Downloadable resume (`assets/pdf/Jonathan-Poeder-Resume.pdf`, from the 2026-09-17 PDF) linked in the nav and contact section on every page (d32422f). To update it, replace that file and push.
- 🤖 2026-10-11: TechTrack case study page and card (a7061f3).
