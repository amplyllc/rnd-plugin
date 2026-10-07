// Roundpit kit runtime. One file for build and browser:
//   Node:    required by data.js, so baked pages and live renders share toView().
//   Browser: loaded by {% rndScripts %}; removes ended events, re-renders [data-rnd-list]
//            regions from the API, and patches the event page hero.
(function (root, factory) {
  var lib = factory()
  if (typeof module === 'object' && module.exports) module.exports = lib
  else if (root.document) lib.start(root.document)
})(typeof self !== 'undefined' ? self : this, function () {
  // A link back to Roundpit's own copy of an event isn't a ticket link: our page replaces it.
  var ROUNDPIT_PAGE = /^https?:\/\/(www\.)?roundpit\.com\//i
  var HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  var THEME_VARS = { tint: '--rnd-tint', accent: '--rnd-accent', accentFg: '--rnd-accent-fg' }
  // ends_at is optional in the API; without it an event counts as over this long after it starts.
  var DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000

  // Every field non-empty, so a site's card macro emits every optional element for fill().
  var PLACEHOLDER = {
    id: '-', updated_at: '-', overAt: '-', starts_at: '-', title: '-', summary: '-',
    summaryShort: '-', purpose: '-', purposeKey: '-', locationName: '-', locationLabel: '-',
    address: '-', tags: '-', dow: '-', month: '-', day: '-', time: '-', dateLabel: '-',
    label: '-', href: '-', ticketUrl: '-'
  }

  function isEvent(i) {
    return !!(i && i.type === 'event' && !i.deleted_at && i.slug && i.starts_at)
  }

  function pagePath(item, paths) {
    if (paths && paths[item.id]) return paths[item.id]
    return item.workspace ? 'events/' + item.workspace + '/' + item.slug : 'events/' + item.slug
  }

  function overAt(item) {
    return item.ends_at || new Date(Date.parse(item.starts_at) + DEFAULT_LENGTH_MS).toISOString()
  }

  function truncate(s, n) {
    s = s || ''
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s
  }

  function themeStyle() {
    var t = {}
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) Object.assign(t, arguments[i])
    return Object.keys(THEME_VARS)
      .filter(function (k) { return HEX.test(t[k] || '') })
      .map(function (k) { return THEME_VARS[k] + ':' + t[k] })
      .join(';')
  }

  // The one shape every slot reads, baked or live. pages maps baked ids to their URLs; an event
  // the last build didn't bake links to its API url instead of a page that doesn't exist yet.
  function toView(item, cfg, pages) {
    var tz = cfg.timeZone
    var d = new Date(item.starts_at)
    function date(opts) { return d.toLocaleDateString('en-US', Object.assign({ timeZone: tz }, opts)) }
    var meta = item.metadata || {}
    var loc = item.location || {}
    var purpose = meta.purpose || ''
    var dow = date({ weekday: 'long' })
    var month = date({ month: 'short' })
    var day = date({ day: 'numeric' })
    return {
      id: item.id,
      updated_at: item.updated_at || '',
      overAt: overAt(item),
      starts_at: item.starts_at,
      title: item.title || '',
      summary: item.summary || '',
      summaryShort: truncate(item.summary, 140),
      purpose: purpose,
      // First word only: site styles key off one-word modifiers (tag-live, ticker-tag--trivia).
      purposeKey: (purpose.toLowerCase().match(/[a-z0-9]+/) || [''])[0],
      locationName: loc.name || '',
      locationLabel: loc.name || 'Location to be announced',
      address: loc.address || '',
      tags: (purpose + ' ' + (loc.name || '')).toLowerCase(),
      dow: dow,
      month: month,
      day: day,
      time: d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }),
      dateLabel: dow + ', ' + month + ' ' + day,
      label: (item.title || '') + ', ' + dow + ', ' + month + ' ' + day,
      href: (pages && pages[item.id]) || item.url || '#',
      ticketUrl: item.url && !ROUNDPIT_PAGE.test(item.url) ? item.url : ''
    }
  }

  /* ── browser ── */

  // Slot contract (README.md):
  //   data-rnd="field"              text
  //   data-rnd-attr="attr:field;…"  attributes (removed when the field is empty)
  //   data-rnd-if="field"           element dropped when the field is empty
  //   data-rnd-mod="prefix-"        class prefix + purposeKey
  function fill(node, v) {
    if (node.hasAttribute('data-rnd-id')) {
      node.setAttribute('data-rnd-id', v.id)
      node.setAttribute('data-rnd-updated', v.updated_at)
      node.setAttribute('data-rnd-over', v.overAt)
    }
    [node].concat([].slice.call(node.querySelectorAll('*'))).forEach(function (el) {
      var d = el.dataset
      if (d.rndIf && !v[d.rndIf]) { el.remove(); return }
      if (d.rnd) el.textContent = v[d.rnd] || ''
      if (d.rndAttr) d.rndAttr.split(';').forEach(function (pair) {
        var p = pair.split(':')
        if (v[p[1]]) el.setAttribute(p[0], v[p[1]])
        else el.removeAttribute(p[0])
      })
      if (d.rndMod) {
        var keep = el.className.split(/\s+/).filter(function (c) { return c && c.indexOf(d.rndMod) !== 0 })
        if (v.purposeKey) keep.push(d.rndMod + v.purposeKey)
        el.className = keep.join(' ')
      }
    })
  }

  // Site scripts (tickers, filters, empty states) listen for this instead of being called.
  function emit(el) {
    el.dispatchEvent(new CustomEvent('rnd:update', { bubbles: true }))
  }

  function prune(doc) {
    var now = Date.now()
    ;[].slice.call(doc.querySelectorAll('[data-rnd-over]')).forEach(function (el) {
      if (Date.parse(el.getAttribute('data-rnd-over')) <= now) el.remove()
    })
  }

  // Every request must succeed before anything renders: one failed workspace would otherwise
  // read as "no events" and wipe its half of every list.
  function load(cfg) {
    var requests = cfg.workspaces.map(function (ws) {
      return { query: 'workspace=' + encodeURIComponent(ws) + '&type=event', missingOk: false }
    }).concat(cfg.events.map(function (id) {
      return { query: 'event=' + encodeURIComponent(id), missingOk: true }
    }))
    return Promise.all(requests.map(function (r) {
      // No timestamp param: visitors share the edge cache, so origin sees one hit per window.
      return fetch(cfg.api + '/api/v1/content?' + r.query, { cache: 'no-cache' })
        .then(function (res) {
          if (res.status === 404 && r.missingOk) return []
          return res.ok ? res.json() : null
        })
        .catch(function () { return null })
    })).then(function (results) {
      if (!results.every(function (r) { return Array.isArray(r) })) return null
      var seen = {}
      return [].concat.apply([], results)
        .filter(function (i) { return isEvent(i) && !seen[i.id] && (seen[i.id] = true) })
        .sort(function (a, b) { return Date.parse(a.starts_at) - Date.parse(b.starts_at) })
    })
  }

  function render(list, items, cfg) {
    var tpl = list.querySelector('template[data-rnd-item]')
    var proto = tpl && tpl.content.firstElementChild
    if (!proto) return
    var now = Date.now()
    var limit = parseInt(list.getAttribute('data-rnd-list'), 10) || Infinity
    var next = items.filter(function (i) { return Date.parse(overAt(i)) > now }).slice(0, limit)
    var current = [].slice.call(list.querySelectorAll(':scope > [data-rnd-id]'))

    // Unchanged list: leave the DOM alone so tickers and filters keep their state.
    var before = current.map(function (el) { return el.getAttribute('data-rnd-id') + '@' + el.getAttribute('data-rnd-updated') })
    var after = next.map(function (i) { return i.id + '@' + (i.updated_at || '') })
    if (before.join() === after.join()) return

    current.forEach(function (el) { el.remove() })
    next.forEach(function (item) {
      var node = proto.cloneNode(true)
      fill(node, toView(item, cfg, cfg.pages))
      list.insertBefore(node, tpl)
    })
    emit(list)
  }

  function patchHero(hero, items, cfg) {
    var id = hero.getAttribute('data-id')
    var item = items.filter(function (i) { return i.id === id })[0]
    // Not in the live list (ended, unpublished): the baked page stands until the next build.
    if (!item || item.updated_at === hero.getAttribute('data-updated-at')) return
    fill(hero, toView(item, cfg, cfg.pages))
    var theme = item.metadata && item.metadata.theme
    var root = hero.closest('[data-rnd-theme-root]')
    if (!theme || !root) return
    Object.keys(THEME_VARS).forEach(function (k) {
      if (HEX.test(theme[k] || '')) root.style.setProperty(THEME_VARS[k], theme[k])
    })
  }

  function start(doc) {
    var cfg
    try { cfg = JSON.parse(doc.getElementById('rnd-config').textContent) } catch (e) { return }
    cfg.pages = cfg.pages.reduce(function (m, p) { m[p[0]] = p[1]; return m }, {})
    var lists = [].slice.call(doc.querySelectorAll('[data-rnd-list]'))
    var hero = doc.querySelector('.rnd-event-hero[data-id]')

    prune(doc)
    lists.forEach(emit)
    if (!lists.length && !hero) return

    load(cfg).then(function (items) {
      if (!items) return
      lists.forEach(function (list) { render(list, items, cfg) })
      if (hero) patchHero(hero, items, cfg)
    })
  }

  return {
    PLACEHOLDER: PLACEHOLDER,
    isEvent: isEvent,
    pagePath: pagePath,
    overAt: overAt,
    themeStyle: themeStyle,
    toView: toView,
    start: start
  }
})
