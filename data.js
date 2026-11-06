
const fs = require('node:fs')
const path = require('node:path')
const kit = require('./rnd.js')

function loadLocal(file) {
  if (!file) return []
  return [].concat(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')))
}

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

async function loadEvents(cfg) {
  const local = loadLocal(cfg.local)
  const dayKey = date => new Date(date).toLocaleDateString('en-CA', { timeZone: cfg.timeZone })

  async function fetchItems(query) {
    const url = `${cfg.api}/api/v1/content?${query}&t=${Date.now()}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
      return null
    }
    const today = dayKey(Date.now())
    return items
      .filter(i => kit.isEvent(i) && dayKey(i.ends_at || i.starts_at) >= today)
      .map(i => ({ ...i, workspace: ws }))
  }

  async function fromEventId(id) {
    const fallback = local.filter(b => b && b.id === id)
    const live = await fetchItems(`event=${encodeURIComponent(id)}`)

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

    return usable.map(item => {
      const has = item.metadata && normalizeCards(item.metadata.cards).length
      if (has || !fallback[0]) return item
      return { ...item, metadata: { ...item.metadata, cards: fallback[0].metadata.cards } }
    })
  }

  const results = await Promise.all([
    ...cfg.workspaces.map(fromWorkspace),
    ...cfg.events.map(fromEventId),
  ])

  const wsResults = results.slice(0, cfg.workspaces.length)
  if (wsResults.length && wsResults.every(r => r === null)) {
    throw new Error(`[rnd] API unreachable for every workspace (${cfg.api}) — aborting to keep the last good deploy.`)
  }
  const batches = results.map(r => r || [])

  const ids = new Set()
  const firstDate = new Set()
  const taken = new Set()
  const entries = batches.flat()
    .filter(i => !ids.has(i.id) && ids.add(i.id))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .map(item => {
      const series = kit.seriesOf(item)
      const own = cfg.paths[item.id]
      if (own || !series) return { item, path: own ? kit.cleanPath(own) : kit.basePath(item, cfg), alias: null }
      const base = kit.basePath(item, cfg)
      const dated = `${base}/${series.date}`
      if (firstDate.has(series.id)) return { item, path: dated, alias: null }
      firstDate.add(series.id)
      return { item, path: base, alias: dated }
    })
    .filter(({ item, path, alias }) => {
      const clash = [path, alias].find(p => p !== null && taken.has(p))
      if (clash !== undefined) {
        console.warn(`[rnd] /${clash}/ already taken — skipping ${item.id}`)
        return false
      }
      taken.add(path)
      if (alias) taken.add(alias)
      return true
    })

  const pages = Object.fromEntries(entries.map(({ item, path }) => [item.id, `/${path}/`]))
  console.log(`[rnd] ${entries.length} event page(s) from ${cfg.workspaces.length} workspace(s), ${cfg.events.length} event id(s) via ${cfg.api}`)

  return entries.map(({ item, path, alias }) => {
    const meta = item.metadata || {}
    const view = kit.toView(item, cfg, pages)
    const cards = normalizeCards(meta.cards).map(c => ({ ...c, open: cfg.openCards.includes(c.id) }))
    console.log(`[rnd] building /${path}/${alias ? ` (also /${alias}/)` : ''} (cards=${cards.length})`)
    return {
      ...item,
      ...view,
      path,
      aliasPath: alias,
      cards,
      upcoming: Date.parse(view.overAt) > Date.now(),
      cta: view.ticketUrl ? { url: view.ticketUrl, label: cfg.ctaLabel } : null,
      themeStyle: kit.themeStyle(cfg.theme, meta.theme),
      jsonLd: jsonLd(item),
    }
  })
}

async function loadSite(cfg) {
  const site = { page: null, pages: {}, hero: null, announcement: null, pageCards: [] }
  for (const ws of cfg.workspaces) {
    const url = `${cfg.api}/api/v1/content?workspace=${encodeURIComponent(ws)}&type=page,hero,announcement&t=${Date.now()}`
    let items
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) { console.warn(`[rnd] ${ws} site items: HTTP ${res.status}`); continue }
      items = await res.json()
    } catch (err) {
      console.warn(`[rnd] ${ws} site items: fetch failed (${err.message})`)
      continue
    }
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || item.deleted_at) continue
      if (item.type === 'page' && !site.pages[ws]) site.pages[ws] = item
      if (item.type === 'hero' && !site.hero) site.hero = item
      if (item.type === 'announcement' && !site.announcement) site.announcement = item
    }
  }
  site.page = site.pages[cfg.workspaces.find(ws => site.pages[ws])] || null
  if (site.page) {
    site.pageCards = normalizeCards(site.page.metadata && site.page.metadata.cards)
      .map(c => ({ ...c, open: cfg.openCards.includes(c.id) }))
  }
  return site
}

module.exports = loadEvents
module.exports.loadSite = loadSite
