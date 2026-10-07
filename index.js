// roundpit-rnd: Roundpit events for Eleventy 3. Setup and options: README.md.
const path = require('node:path')
const loadEvents = require('./data.js')
const html = require('./html.js')
const kit = require('./rnd.js')

const DEFAULTS = {
  api: process.env.ROUNDPIT_API_BASE || 'https://roundpit.com',
  strict: process.env.STRICT_API === '1',
  workspaces: [],
  events: [],
  paths: {},
  openCards: [],
  ctaLabel: 'Get tickets',
  theme: null,
  timeZone: 'America/New_York',
  local: null,
  layout: 'layouts/base.njk',
  extras: null,
  pageData: {},
  assetsPath: '/assets/rnd',
}

module.exports = function rnd(eleventyConfig, options = {}) {
  const cfg = { ...DEFAULTS, ...options }
  cfg.api = cfg.api.replace(/\/+$/, '')
  const assets = cfg.assetsPath.replace(/^\/+|\/+$/g, '')

  // Filled by the eventPages data function, which Eleventy runs before any template renders.
  let pages = []

  eleventyConfig.addGlobalData('rnd', { placeholder: kit.PLACEHOLDER, timeZone: cfg.timeZone })
  eleventyConfig.addGlobalData('eventPages', async () => {
    pages = await loadEvents(cfg)
    return pages
  })

  const extras = cfg.extras ? `{% include ${JSON.stringify(cfg.extras)} %}` : ''
  eleventyConfig.addTemplate('rnd-event-pages.njk', `{% rndEventPage event %}${extras}{% endrndEventPage %}`, {
    ...cfg.pageData,
    layout: cfg.layout,
    pagination: { data: 'eventPages', size: 1, alias: 'event', addAllPagesToCollections: true },
    permalink: data => `/${data.event.path}/`,
    eleventyComputed: {
      title: data => data.event.title,
      description: data => (data.event.summary || '').slice(0, 155),
    },
  })

  eleventyConfig.addPairedShortcode('rndEventPage', (content, event) => html.eventPage(event, content))
  eleventyConfig.addShortcode('rndHead', () => html.head(cfg))
  eleventyConfig.addShortcode('rndScripts', () => html.scripts(cfg, pages))

  // Relative to the project root: Eleventy's passthrough expects project paths, and this
  // folder may sit in node_modules or, during kit development, next to the site.
  const rel = file => path.relative(process.cwd(), path.join(__dirname, file))
  eleventyConfig.addPassthroughCopy({
    [rel('rnd.js')]: `${assets}/rnd.js`,
    [rel('rnd.css')]: `${assets}/rnd.css`,
  })
}
