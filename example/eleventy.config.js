const rnd = require('..')

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(rnd, {
    events: ['f0e1d2c3-b4a5-4968-8776-655443322110'],
    local: 'example/events-local.json',
    openCards: ['details'],
  })
  return { dir: { input: 'example/src', output: 'example/_site' } }
}
