# rnd-plugin

Roundpit events for Eleventy 3 sites: a page per event, live event lists, and event data for
your own templates.

## Install

    npm install github:YOUR_GITHUB/rnd-plugin#v1.0.0

Eleventy config:

    eleventyConfig.addPlugin(require("rnd-plugin"), {
      workspaces: ["willow-rock-cicero"],
      theme: { tint: "#003874", accent: "#7dc243", accentFg: "#0f0f0f" },
    })

Base layout: `{% rndHead %}` in `<head>`, `{% rndScripts %}` before `</body>`.

Netlify: put the site's build hook URL in Roundpit, set `STRICT_API=1` on production.

## Options

| Option | Default | |
|---|---|---|
| `workspaces` | `[]` | Location slugs; each upcoming event gets a page at `/events/<workspace>/<slug>/` |
| `events` | `[]` | Ids of location-less events; always built, past or not, at `/events/<slug>/` |
| `paths` | `{}` | `{ id: "custom/path" }` page URL overrides |
| `openCards` | `[]` | Card ids rendered open |
| `ctaLabel` | `"Get tickets"` | Hero button text (shown when the event has a ticket link) |
| `theme` | `null` | `{ tint, accent, accentFg }` hex colors |
| `timeZone` | `"America/New_York"` | |
| `local` | `null` | JSON file (project-relative) of events with cards the API doesn't carry yet; also the fallback for `events` ids when the API is down |
| `layout` | `"layouts/base.njk"` | Layout for event pages |
| `extras` | `null` | Include rendered inside every event page (sponsors, etc.) |
| `pageData` | `{}` | Extra front matter for event pages |
| `assetsPath` | `"/assets/rnd"` | Where `rnd.css` / `rnd.js` are copied |
| `api` | `ROUNDPIT_API_BASE` or `https://roundpit.com` | |

Environment: `ROUNDPIT_API_BASE` (local Next app: `http://localhost:3000`), `STRICT_API=1` (fail
the build instead of shipping without pages).

Pages exist only after a build; lists update live. Locally, restart the dev server for new pages.

## Data

- `eventPages`: every event with a page, soonest first. Each entry is the API item plus the
  `toView()` fields in `rnd.js` (`dateLabel`, `href`, `purposeKey`, …) and `path`, `upcoming`.
- `rnd.placeholder`: for list templates (below).

## Event lists

Any element can be a live list. Keep your own card markup in a macro:

    {% set list = eventPages | selectattr("upcoming") %}
    <div class="my-grid" data-rnd-list="20">
      {% for e in list.slice(0, 20) %}{{ myCard(e) }}{% endfor %}
      <template data-rnd-item>{{ myCard(rnd.placeholder) }}</template>
    </div>

In the card macro:

- root: `data-rnd-id="{{ e.id }}" data-rnd-updated="{{ e.updated_at }}" data-rnd-over="{{ e.overAt }}"`
- text: `data-rnd="field"`; attributes: `data-rnd-attr="href:href;aria-label:label"`
- optional parts: `data-rnd-if="field"`; category class: `data-rnd-mod="tag-"` → `tag-<purposeKey>`

After any change rnd.js fires a bubbling `rnd:update` event; tickers, filters and empty states
listen for it. Any element with `data-rnd-over` is removed once that time passes.

## Developing the kit

    npm install
    npm run example                       # example site at http://localhost:8080

Against a real site: `npm install ../rnd-plugin` in the site, test, then tag a release here
and point the site back at the tag.

## Versions

Tags follow semver: patch = fix, minor = new feature, major = sites must change their own code.
Each site pins a tag, so an update reaches a site only when that site installs it.
See CHANGELOG.md.
