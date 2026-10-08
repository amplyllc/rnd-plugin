// Event page markup as plain functions, so the plugin has no template files for a site to
// resolve. Every interpolated value goes through esc(); class names match rnd.css.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ESCAPES[c])

const ICON_DATE = '<svg class="rnd-info-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
const ICON_PLACE = '<svg class="rnd-info-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
const CHEVRON = '<svg class="rnd-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>'

function hero(e) {
  const src = e.image
  const poster = src ? `
    <div class="rnd-poster-col">
      <div class="rnd-poster">
        <div class="rnd-poster-sheet">
          <img class="rnd-poster-img" src="${esc(src)}" alt="${esc(e.imageAlt)}" data-rnd-attr="src:image;alt:imageAlt" fetchpriority="high" decoding="async">
        </div>
        <div class="rnd-tape rnd-tl"></div>
        <div class="rnd-tape rnd-tr"></div>
        <div class="rnd-tape rnd-bl"></div>
        <div class="rnd-tape rnd-br"></div>
      </div>
    </div>` : ''
  const cta = e.cta ? `
        <div class="rnd-actions">
          <a class="rnd-rsvp-btn" data-rnd-attr="href:ticketUrl" href="${esc(e.cta.url)}" target="_blank" rel="noopener noreferrer">${esc(e.cta.label)}</a>
        </div>` : ''

  return `<section class="rnd-event-hero" data-id="${esc(e.id)}" data-updated-at="${esc(e.updated_at)}">
  ${src ? `<div class="rnd-hero-bg" aria-hidden="true"><img class="rnd-hero-bg-img" src="${esc(src)}" alt="" data-rnd-attr="src:image" decoding="async"></div>` : ''}
  <div class="rnd-hero-overlay" aria-hidden="true"></div>
  <div class="rnd-inner${src ? '' : ' rnd-solo'}">${poster}
    <div class="rnd-content">
      <div class="rnd-hero-content">
        ${e.purpose ? `<span class="rnd-category" data-rnd="purpose">${esc(e.purpose)}</span>` : ''}
        <h1 class="rnd-title" data-rnd="title">${esc(e.title)}</h1>
        ${e.summary ? `<p class="rnd-summary" data-rnd="summary">${esc(e.summary)}</p>` : ''}
      </div>
      <div class="rnd-info-card">
        <div class="rnd-info-row">
          <div class="rnd-info-icon">${ICON_DATE}</div>
          <div class="rnd-info-body">
            <p class="rnd-info-text"><time data-rnd="dateLabel" data-rnd-attr="datetime:starts_at" datetime="${esc(e.starts_at)}">${esc(e.dateLabel)}</time></p>
            <p class="rnd-info-meta" data-rnd="time">${esc(e.time)}</p>
          </div>
        </div>
        <hr class="rnd-divider">
        <div class="rnd-info-row">
          <div class="rnd-info-icon">${ICON_PLACE}</div>
          <div class="rnd-info-body">
            <p class="rnd-info-text" data-rnd="locationLabel">${esc(e.locationLabel)}</p>
            ${e.address ? `<p class="rnd-info-meta" data-rnd="address">${esc(e.address)}</p>` : ''}
          </div>
        </div>${cta}
      </div>
    </div>
  </div>
</section>`
}

function cardItem(item) {
  switch (item.type) {
    case 'text':
      return `<p class="rnd-card__text">${esc(item.value)}</p>`
    case 'detail':
      return `<div class="rnd-card__detail"><span class="rnd-card__detail-label">${esc(item.label)}</span><span class="rnd-card__detail-value">${esc(item.value)}</span></div>`
    case 'link': {
      const external = String(item.url || '').startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''
      const download = item.download ? ` download="${esc(item.download)}"` : ''
      return `<a class="rnd-card__link" href="${esc(item.url)}"${download}${external}>${esc(item.label)}</a>`
    }
    case 'image':
      return `<picture class="rnd-card__picture">${item.srcMobile ? `<source srcset="${esc(item.src)}" media="(min-width: 600px)">` : ''}<img class="rnd-card__img" src="${esc(item.srcMobile || item.src)}" alt="${esc(item.alt)}" loading="lazy" decoding="async"></picture>`
    case 'tier':
      return `<div class="rnd-card__tier">
        <div class="rnd-card__tier-head"><span class="rnd-card__tier-label">${esc(item.label)}</span>${item.price ? `<span class="rnd-card__tier-price">${esc(item.price)}</span>` : ''}</div>
        ${item.includes ? `<p class="rnd-card__tier-includes">Includes ${esc(item.includes)}, plus:</p>` : ''}
        ${item.perks ? `<ul class="rnd-card__tier-perks">${item.perks.map(p => `<li class="rnd-card__tier-perk">${esc(p)}</li>`).join('')}</ul>` : ''}
        ${item.note ? `<p class="rnd-card__tier-note">${esc(item.note)}</p>` : ''}
      </div>`
    default:
      return ''
  }
}

// <details> so the accordion works without JS; card.open comes from the openCards option.
function cards(list) {
  if (!list || !list.length) return ''
  return `<div class="rnd-cards">${list.map(card => `
  <details class="rnd-card" id="card-${esc(card.id)}"${card.open ? ' open' : ''}>
    <summary class="rnd-card__trigger">
      <span class="rnd-card__icon rnd-card__icon--${esc(card.icon)}" aria-hidden="true"></span>
      <span class="rnd-card__label">${esc(card.label)}</span>
      ${CHEVRON}
    </summary>
    <div class="rnd-card__body">${(card.items || []).map(cardItem).join('')}</div>
  </details>`).join('')}
</div>`
}

const ISLAND_BACK = '<svg class="rnd-island__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>'
const ISLAND_SHARE = '<svg class="rnd-island__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>'

// The site's layout renders this in place of its own header on event pages; content is the
// site's own extra buttons (a menu toggle), slotted after Share.
function islandNav(content, backHref) {
  return `<nav class="rnd-islands" aria-label="Page navigation">
<a class="rnd-island" href="${esc(backHref || '/')}" aria-label="Back">${ISLAND_BACK}</a>
<div class="rnd-islands__end">
<button type="button" class="rnd-island" data-rnd-share aria-label="Share">${ISLAND_SHARE}</button>
${content || ''}
</div>
</nav>`
}

// extras: the site's include, already rendered, placed inside the themed wrapper.
function eventPage(e, extras) {
  const style = e.themeStyle ? ` style="${esc(e.themeStyle)}"` : ''
  return `<div class="rnd-event-page" data-rnd-theme-root${style}>
<script type="application/ld+json">${e.jsonLd}</script>
${hero(e)}
${cards(e.cards)}
${extras || ''}
</div>`
}

function head(cfg) {
  return `<link rel="stylesheet" href="${esc(cfg.assetsPath)}/rnd.css">`
}

// pages are [id, url] pairs so live renders link to pages that exist.
function scripts(cfg, pages) {
  const config = JSON.stringify({
    api: cfg.api,
    timeZone: cfg.timeZone,
    workspaces: cfg.workspaces,
    events: cfg.events,
    pages: pages.map(p => [p.id, `/${p.path}/`]),
  }).replace(/</g, '\\u003c')
  return `<script type="application/json" id="rnd-config">${config}</script>
<script src="${esc(cfg.assetsPath)}/rnd.js" defer></script>`
}

module.exports = { eventPage, head, scripts, islandNav }
