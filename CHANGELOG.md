# Changelog

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

