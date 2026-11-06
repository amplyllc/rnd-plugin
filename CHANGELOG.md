# Changelog

## 2.0.0

- A workspace is a page slug: a venue or an organization. Usernames no longer work; put the
  organization's slug in `workspaces` instead.
- An organization's workspace returns the events it hosts, wherever they happen. A venue's
  returns events at it and events it hosts elsewhere.
- The page item's type is `page` (was `profile` / `venue`), with `metadata.kind`.
- `rndSite.pages`: every workspace's page, keyed by slug. `rndSite.page` is still the first one.

## 1.4.0

- `prefix` option: the folder for event pages; `""` puts them at the site root.
- Regular events get one stable URL: the next date at `<prefix>/<slug>/`, later dates at
  `<prefix>/<slug>/<date>/`, and the next date's dated URL redirects to the stable one.
  Sites with regular events: their date URLs change from `<slug>-<date>` once.
- `paths` keyed by an event's UUID now covers every date of a regular event.

## 1.3.2

- Removes a stray self-dependency from `package.json`. No code change.

## 1.3.1

- The `v1.3.0` tag points at 1.2.1 code; install 1.3.1 instead.
- `rndSite` data: the workspace's page (`profile` or `venue`), hero and banner, for site headers,
  footers and About pages.
- `{% rndPageCards %}` renders the page's info sections with the event-page card markup.
- README documents the API contract: item types, per-date regular events, tombstones, full fetches.

## 1.2.1

- Every link the kit writes is scheme-checked by one `safeUrl` in `rnd.js`: info-section card
  links, event `href` and `ticketUrl`, baked and live. Anything other than http(s), mailto, tel
  or a same-site path renders without a link.

## 1.2.0

- `workspaces` accepts a username: every event that person posts, at any location.
- `events` is deprecated in favor of a username workspace.

## 1.1.0

- Add rndIslands shortcode and share modal

## 1.0.3

- Event images are versioned with `?v=<updated_at>`, so a replaced upload (same storage path)
  shows on the next load; the live hero patch now updates the poster and background image.

## 1.0.2

- Builds abort when the API answers for no workspace, so an outage keeps the last good deploy
  instead of publishing an empty site. `STRICT_API=1` still also aborts on a partial outage.

## 1.0.1

- Live lists no longer wipe baked events when the API answers 404 for an event id
  (local-only events, wrong environment). Deletions still apply via tombstones.

## 1.0.0

- Initialize - RND now an installable plugin

