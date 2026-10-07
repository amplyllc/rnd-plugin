// Build-time events: GET /api/v1/content → one entry per event page. Shaped by rnd.js toView(),
// which the browser also runs, so baked pages and live renders agree.
const fs = require('node:fs')
const path = require('node:path')
const kit = require('./rnd.js')

// Local cards and fallbacks, for content the API doesn't carry yet. Re-read every build so
// edits show up under --serve.
function loadLocal(file) {
  if (!file) return []
  return [].concat(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')))
}

// Accepts a flat card array or the old tdr.json wrapper [{ eventSlug, cards: [...] }].
function normalizeCards(cards) {
  if (!Array.isArray(cards)) return []
  if (cards.length && cards[0] && Array.isArray(cards[0].cards)) return cards.flatMap(c => c.cards)
  return cards
}

function jsonLd(i) {
  const image = i.media && i.media[0] && i.media[0].url
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: i.title,
    description: i.summary || undefined,
    startDate: i.starts_at,
    endDate: i.ends_at || undefined,
    image: image || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: i.location
      ? { '@type': 'Place', name: i.location.name, address: i.location.address || undefined }
      : undefined,
  }).replace(/</g, '\\u003c')
}

module.exports = async function loadEvents(cfg) {
  const local = loadLocal(cfg.local)
  const dayKey = date => new Date(date).toLocaleDateString('en-CA', { timeZone: cfg.timeZone })

  // null = API unreachable; [] = reachable, nothing there.
  async function fetchItems(query) {
    // The timestamp skips the 60s edge cache, so a rebuild fired by an edit sees that edit.
    const url = `${cfg.api}/api/v1/content?${query}&t=${Date.now()}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      // 404 is a real answer (unknown workspace, missing route, unknown event) but never a silent one.
      if (res.status === 404) { console.warn(`[rnd] ${query}: 404 not found`); return [] }
      if (!res.ok) { console.warn(`[rnd] ${query}: HTTP ${res.status}`); return null }
      const items = await res.json()
      return Array.isArray(items) ? items : []
    } catch (err) {
      console.warn(`[rnd] ${query}: fetch failed (${err.message})`)
      return null
    }
  }

  async function fromWorkspace(ws) {
    const items = await fetchItems(`workspace=${encodeURIComponent(ws)}&type=event`)
    if (items === null) {
      if (cfg.strict) throw new Error(`[rnd] ${ws}: API unreachable, STRICT_API=1 — aborting.`)
      console.warn(`[rnd] ${ws}: API unreachable — no pages for this workspace`)
      return []
    }
    const today = dayKey(Date.now())
    return items
      .filter(i => kit.isEvent(i) && dayKey(i.ends_at || i.starts_at) >= today)
      .map(i => ({ ...i, workspace: ws }))
  }

  async function fromEventId(id) {
    const fallback = local.filter(b => b && b.id === id)
    const live = await fetchItems(`event=${encodeURIComponent(id)}`)

    // A tombstone means it was deleted on purpose; don't resurrect it from the local file.
    if (live && live.some(i => i && i.deleted_at)) {
      console.warn(`[rnd] ${id}: deleted on API — skipping`)
      return []
    }

    const usable = (live || []).filter(kit.isEvent)
    if (!usable.length) {
      const why = live === null ? 'API unreachable' : 'not found on API'
      if (cfg.strict) throw new Error(`[rnd] ${id}: ${why}, STRICT_API=1 — aborting.`)
      console.warn(`[rnd] ${id}: ${why} — using ${cfg.local || 'nothing (no local file)'}`)
      return fallback
    }

    // API wins; local cards fill in until the API carries cards for this event.
    return usable.map(item => {
      const has = item.metadata && normalizeCards(item.metadata.cards).length
      if (has || !fallback[0]) return item
      return { ...item, metadata: { ...item.metadata, cards: fallback[0].metadata.cards } }
    })
  }

  const batches = await Promise.all([
    ...cfg.workspaces.map(fromWorkspace),
    ...cfg.events.map(fromEventId),
  ])

  const ids = new Set()
  const taken = new Set()
  const entries = batches.flat()
    .filter(i => !ids.has(i.id) && ids.add(i.id))
    .map(item => ({ item, path: kit.pagePath(item, cfg.paths) }))
    .filter(({ item, path }) => {
      if (taken.has(path)) {
        console.warn(`[rnd] /${path}/ already taken — skipping ${item.id}`)
        return false
      }
      taken.add(path)
      return true
    })
    .sort((a, b) => Date.parse(a.item.starts_at) - Date.parse(b.item.starts_at))

  const pages = Object.fromEntries(entries.map(({ item, path }) => [item.id, `/${path}/`]))
  console.log(`[rnd] ${entries.length} event page(s) from ${cfg.workspaces.length} workspace(s), ${cfg.events.length} event id(s) via ${cfg.api}`)

  return entries.map(({ item, path }) => {
    const meta = item.metadata || {}
    const view = kit.toView(item, cfg, pages)
    const cards = normalizeCards(meta.cards).map(c => ({ ...c, open: cfg.openCards.includes(c.id) }))
    console.log(`[rnd] building /${path}/ (cards=${cards.length})`)
    return {
      ...item,
      ...view,
      path,
      cards,
      // Lists filter on this at build; pages still build for ended events so links never 404.
      upcoming: Date.parse(view.overAt) > Date.now(),
      cta: view.ticketUrl ? { url: view.ticketUrl, label: cfg.ctaLabel } : null,
      themeStyle: kit.themeStyle(cfg.theme, meta.theme),
      jsonLd: jsonLd(item),
    }
  })
}
