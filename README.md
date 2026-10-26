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
| `workspaces` | `[]` | Location slugs or usernames; each upcoming event gets a page at `/events/<workspace>/<slug>/`. A username covers every event that person posts, wherever it happens |
| `events` | `[]` | Deprecated: put the poster's username in `workspaces`. Ids of single events; always built, past or not, at `/events/<slug>/` |
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

## Island nav

On event pages, swap your header for floating Back and Share buttons (with a share modal). In the
header partial:

    {% if event %}
      {% rndIslands "/events/" %}{% endrndIslands %}
    {% else %}
      ...your header...
    {% endif %}

`event` is set only on the plugin's event pages. The argument is the Back link (default `/`).
Anything between the tags goes after Share, so a site can slot its own menu toggle; give it
`class="rnd-island"`, and `class="rnd-island__icon"` on its svg, to match.

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

## Releasing

Every change a site should get ships as a tagged release, from a clean `main`:

1. The change, plus any new runtime file added to `files` in `package.json` (a site only gets
   what `files` lists).
2. `version` in `package.json` bumped by the rules above, and a `## X.Y.Z` entry at the top of
   `CHANGELOG.md` saying what changed for sites.
3. `npm install` (syncs `package-lock.json`), `npm run example`, and `npm pack --dry-run` (the
   file list a site will install).
4. One commit, an annotated tag on that commit, both pushed:

       git add <changed files>
       git commit -m "X.Y.Z: <summary>"
       git tag -a vX.Y.Z -m "vX.Y.Z"
       git push origin main vX.Y.Z

5. In each site: `npm install github:amplyllc/rnd-plugin#vX.Y.Z`, build, then commit
   `package.json` and `package-lock.json`.

Never move or reuse a tag. A mistake ships as the next patch.
