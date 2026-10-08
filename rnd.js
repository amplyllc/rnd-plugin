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
    label: '-', href: '-', ticketUrl: '-', image: '-', imageAlt: '-'
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
    var media = (item.media && item.media[0]) || {}
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
      ticketUrl: item.url && !ROUNDPIT_PAGE.test(item.url) ? item.url : '',
      // Uploads reuse the same storage path, so the URL alone never changes; the version param
      // makes browsers and the CDN fetch a replaced image.
      image: media.url ? media.url + (media.url.indexOf('?') < 0 ? '?' : '&') + 'v=' + encodeURIComponent(item.updated_at || '') : '',
      imageAlt: media.alt || item.title || ''
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
    var queries = cfg.workspaces.map(function (ws) {
      return 'workspace=' + encodeURIComponent(ws) + '&type=event'
    }).concat(cfg.events.map(function (id) {
      return 'event=' + encodeURIComponent(id)
    }))
    return Promise.all(queries.map(function (query) {
      // No timestamp param: visitors share the edge cache, so origin sees one hit per window.
      return fetch(cfg.api + '/api/v1/content?' + query, { cache: 'no-cache' })
        .then(function (res) {
          // Deletions arrive as tombstones (200 + deleted_at). A 404 means this API has never seen
          // the event (local-only, wrong environment), so it can't vouch for the baked list.
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

  // Browser-only. Built on first use because its links need the live URL, which the build doesn't know.
  function buildShare(doc, win, root) {
    function node(tag, cls, text) {
      var n = doc.createElement(tag)
      if (cls) n.className = cls
      if (text) n.textContent = text
      return n
    }
    var enc = encodeURIComponent
    var channels = [
      { label: 'Text', href: function (t, u) { return 'sms:?&body=' + enc(t + ' ' + u) } },
      { label: 'WhatsApp', external: true, href: function (t, u) { return 'https://wa.me/?text=' + enc(t + ' ' + u) } },
      { label: 'X', external: true, href: function (t, u) { return 'https://twitter.com/intent/tweet?text=' + enc(t) + '&url=' + enc(u) } },
      { label: 'Facebook', external: true, href: function (t, u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u) } },
      { label: 'Email', href: function (t, u) { return 'mailto:?subject=' + enc(t) + '&body=' + enc(u) } }
    ]

    var layer = node('div', 'rnd-share')
    var scrim = node('div', 'rnd-share__scrim')
    scrim.setAttribute('data-rnd-close', '')
    var panel = node('div', 'rnd-share__panel')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-labelledby', 'rnd-share-title')

    var head = node('div', 'rnd-share__head')
    var title = node('p', 'rnd-share__title', 'Share')
    title.id = 'rnd-share-title'
    var close = node('button', 'rnd-share__close', '\u00d7')
    close.type = 'button'
    close.setAttribute('aria-label', 'Close')
    close.setAttribute('data-rnd-close', '')
    head.appendChild(title)
    head.appendChild(close)

    var row = node('div', 'rnd-share__copy-row')
    var input = node('input', 'rnd-share__url')
    input.type = 'text'
    input.readOnly = true
    input.setAttribute('aria-label', 'Page link')
    var copy = node('button', 'rnd-share__copy', 'Copy link')
    copy.type = 'button'
    row.appendChild(input)
    row.appendChild(copy)

    var list = node('div', 'rnd-share__channels')
    var links = channels.map(function (c) {
      var a = node('a', 'rnd-share__channel', c.label)
      if (c.external) { a.target = '_blank'; a.rel = 'noopener noreferrer' }
      list.appendChild(a)
      return a
    })

    var current = { title: '', url: '' }
    if (win.navigator.share) {
      var more = node('button', 'rnd-share__channel', 'More\u2026')
      more.type = 'button'
      // A dismissed sheet rejects; there is nothing to report either way.
      more.addEventListener('click', function () {
        win.navigator.share({ title: current.title, url: current.url }).catch(function () {})
      })
      list.appendChild(more)
    }

    copy.addEventListener('click', function () {
      var clip = win.navigator.clipboard
      function done() {
        copy.textContent = 'Copied'
        setTimeout(function () { copy.textContent = 'Copy link' }, 2000)
      }
      // Without clipboard access, selecting the field lets the person copy by hand.
      if (clip && clip.writeText) clip.writeText(input.value).then(done, function () { input.select() })
      else input.select()
    })

    panel.appendChild(head)
    panel.appendChild(row)
    panel.appendChild(list)
    layer.appendChild(scrim)
    layer.appendChild(panel)
    root.appendChild(layer)

    return {
      layer: layer,
      panel: panel,
      fill: function (t, u) {
        current.title = t
        current.url = u
        input.value = u
        channels.forEach(function (c, i) { links[i].href = c.href(t, u) })
      }
    }
  }

  // Delegated, so the Share island (rendered by the site's layout, outside the event page) needs no wiring.
  // The modal mounts inside the themed wrapper so it picks up the site's --rnd-* colors.
  function bindIslands(doc) {
    var win = doc.defaultView
    var root = doc.querySelector('[data-rnd-theme-root]') || doc.body
    var share = null
    var trigger = null
    var scrollWas = ''

    function focusables() {
      return [].slice.call(share.panel.querySelectorAll('a[href], button, input'))
    }

    function close() {
      if (!trigger) return
      share.layer.classList.remove('is-open')
      doc.body.style.overflow = scrollWas
      trigger.focus()
      trigger = null
    }

    function open(btn) {
      if (!share) share = buildShare(doc, win, root)
      share.fill(doc.title, win.location.origin + win.location.pathname)
      trigger = btn
      share.layer.classList.add('is-open')
      scrollWas = doc.body.style.overflow
      doc.body.style.overflow = 'hidden'
      focusables()[0].focus()
    }

    doc.addEventListener('click', function (e) {
      var hit = e.target.closest && e.target.closest('[data-rnd-share], [data-rnd-close]')
      if (!hit) return
      if (hit.hasAttribute('data-rnd-close')) { close(); return }
      e.preventDefault()
      open(hit)
    })

    doc.addEventListener('keydown', function (e) {
      if (!trigger) return
      if (e.key === 'Escape') { close(); return }
      if (e.key !== 'Tab') return
      var f = focusables()
      var first = f[0]
      var last = f[f.length - 1]
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus() }
    })
  }

  function start(doc) {
    // First, before the config and early returns: the islands work on any page that renders them.
    bindIslands(doc)
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
