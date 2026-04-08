(function () {
  const factRows = [
    ['年份', 'year'],
    ['地区', 'country'],
    ['类型', 'genre'],
    ['语言', 'language'],
    ['上映', 'release_date'],
    ['集数', 'episodes'],
    ['时长', 'runtime'],
    ['导演', 'director'],
    ['编剧', 'writer'],
    ['主演', 'cast']
  ]

  const toArray = value => {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (value === null || value === undefined || value === '') return []
    return [value]
  }

  const stringifyValue = value => toArray(value).join(' / ')

  const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const createFactMarkup = item => factRows
    .map(([label, key]) => {
      const value = stringifyValue(item[key])
      if (!value) return ''
      return [
        '<div class="watch-entry__fact">',
        '  <dt class="watch-entry__fact-label">' + escapeHtml(label) + '</dt>',
        '  <dd class="watch-entry__fact-value">' + escapeHtml(value) + '</dd>',
        '</div>'
      ].join('')
    })
    .filter(Boolean)
    .join('')

  const createActionMarkup = actions => actions.map(action => {
    const kind = action.kind || 'default'
    return '<a class="watch-entry__action watch-entry__action--' + escapeHtml(kind) + '" href="' + escapeHtml(action.url) + '" target="_blank" rel="noopener external nofollow">' + escapeHtml(action.label) + '</a>'
  }).join('')

  const createEntryMarkup = (item, index) => {
    const entryId = item.id || ('watch-entry-' + (index + 1))
    const aliasText = [item.original_title, item.english_title].filter(Boolean).join(' / ')
    const actions = Array.isArray(item.actions) ? item.actions.filter(action => action && action.label && action.url) : []
    if (item.review_post_url) {
      actions.unshift({
        label: item.review_post_label || '观影记录',
        url: item.review_post_url,
        kind: 'note'
      })
    }

    const qrTarget = item.qr_target || item.copy_text || (actions[0] && actions[0].url) || ''
    const copyValue = item.copy_text || qrTarget
    const posterMarkup = item.cover
      ? '<div class="watch-entry__poster-wrap"><img class="watch-entry__poster" src="' + escapeHtml(item.cover) + '" alt="' + escapeHtml(item.title || 'Watching cover') + '" loading="lazy"></div>'
      : '<div class="watch-entry__poster-wrap watch-entry__poster-wrap--placeholder"><i class="fas fa-film" aria-hidden="true"></i><span>等待封面</span></div>'
    const qrMarkup = qrTarget
      ? '<div class="watch-entry__qr"><img class="watch-entry__qr-image" data-qr-target="' + escapeHtml(qrTarget) + '" alt="' + escapeHtml((item.title || 'Watching') + ' 扫码入口') + '" loading="lazy"><p class="watch-entry__qr-text">手机扫码可快速打开当前条目链接</p></div>'
      : '<div class="watch-entry__qr"><div class="watch-entry__qr-empty"><i class="fas fa-qrcode" aria-hidden="true"></i><span>补充资源链接后，这里会自动生成二维码</span></div></div>'
    const actionsMarkup = actions.length || copyValue
      ? '<div class="watch-entry__actions">' + createActionMarkup(actions) + (copyValue ? '<button class="watch-entry__action watch-entry__action--copy" type="button" data-copy="' + escapeHtml(copyValue) + '">复制链接</button>' : '') + '</div>'
      : ''
    const updatedMarkup = item.updated_at
      ? '<div class="watch-entry__updated"><i class="far fa-clock" aria-hidden="true"></i><span>最近更新：' + escapeHtml(item.updated_at) + '</span></div>'
      : ''

    return [
      '<article class="watch-entry" id="' + escapeHtml(entryId) + '" data-search="' + escapeHtml([
        item.title,
        item.original_title,
        item.english_title,
        item.type,
        item.status,
        item.year,
        item.country,
        stringifyValue(item.genre),
        item.language,
        item.release_date,
        item.runtime,
        item.episodes,
        item.director,
        item.writer,
        stringifyValue(item.cast),
        item.summary,
        item.watch_note
      ].filter(Boolean).join(' ').toLowerCase()) + '">',
      '  <div class="watch-entry__header">',
      '    <div class="watch-entry__header-main">',
      '      <p class="watch-entry__type">' + escapeHtml(item.type || '影视条目') + '</p>',
      '      <h3 class="watch-entry__title">' + escapeHtml(item.title || ('未命名条目 ' + (index + 1))) + '</h3>',
      aliasText ? '      <p class="watch-entry__alias">' + escapeHtml(aliasText) + '</p>' : '',
      '    </div>',
      item.status ? '    <span class="watch-entry__status">' + escapeHtml(item.status) + '</span>' : '',
      '  </div>',
      '  <div class="watch-entry__body">',
      '    <div class="watch-entry__main">',
      '      <div class="watch-entry__section">',
      '        <h4 class="watch-entry__section-title">基础信息</h4>',
      '        <dl class="watch-entry__facts">' + createFactMarkup(item) + '</dl>',
      '      </div>',
      item.summary || item.watch_note ? '      <div class="watch-entry__section"><h4 class="watch-entry__section-title">资源描述</h4>' + (item.summary ? '<p class="watch-entry__paragraph">' + escapeHtml(item.summary) + '</p>' : '') + (item.watch_note ? '<p class="watch-entry__paragraph watch-entry__paragraph--note">' + escapeHtml(item.watch_note) + '</p>' : '') + '</div>' : '',
      updatedMarkup,
      '    </div>',
      '    <aside class="watch-entry__aside">',
      posterMarkup,
      qrMarkup,
      '    </aside>',
      '  </div>',
      actionsMarkup,
      '</article>'
    ].filter(Boolean).join('')
  }

  const initWatchingLibrary = async () => {
    const root = document.querySelector('#watching-library')
    if (!root || root.dataset.enhanced === 'true') return

    root.dataset.enhanced = 'true'

    const source = root.dataset.source
    const listNode = root.querySelector('[data-watching-list]')
    const searchInput = root.querySelector('[data-watching-search]')
    const emptyState = root.querySelector('[data-watching-empty]')
    const blankState = root.querySelector('[data-watching-blank]')
    const countNode = root.querySelector('[data-watch-count]')
    const totalNode = root.querySelector('[data-watch-total]')
    const resourceNode = root.querySelector('[data-watch-resources]')
    const latestNode = root.querySelector('[data-watch-updated]')

    if (!source || !listNode) return

    try {
      const response = await fetch(source, { cache: 'no-store' })
      if (!response.ok) throw new Error('watching library fetch failed')

      const payload = await response.json()
      const entries = Array.isArray(payload.entries) ? payload.entries : []
      const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {}
      const latestUpdatedAt = entries.reduce((result, item) => {
        if (!item || !item.updated_at) return result
        return !result || String(item.updated_at) > String(result) ? item.updated_at : result
      }, '')
      const resourceCount = entries.reduce((result, item) => {
        const count = Array.isArray(item && item.actions) ? item.actions.length : 0
        return result + count + (item && item.review_post_url ? 1 : 0)
      }, 0)

      if (searchInput && meta.search_placeholder) {
        searchInput.placeholder = meta.search_placeholder
      }
      if (emptyState) {
        emptyState.dataset.emptyText = meta.empty_text || root.dataset.emptyText || '没有找到匹配的影视条目。'
        const textNode = emptyState.querySelector('p')
        if (textNode) textNode.textContent = emptyState.dataset.emptyText
      }

      if (totalNode) totalNode.textContent = String(entries.length)
      if (countNode) countNode.textContent = String(entries.length)
      if (resourceNode) resourceNode.textContent = String(resourceCount)
      if (latestNode) latestNode.textContent = latestUpdatedAt || '待更新'

      if (!entries.length) {
        if (blankState) blankState.hidden = false
        listNode.innerHTML = ''
        return
      }

      listNode.innerHTML = entries.map(createEntryMarkup).join('')

      const entryNodes = Array.from(listNode.querySelectorAll('.watch-entry'))

      const updateCount = visibleCount => {
        if (countNode) countNode.textContent = String(visibleCount)
        if (emptyState) {
          emptyState.hidden = visibleCount !== 0
        }
      }

      const applySearch = () => {
        const keyword = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase()
        let visibleCount = 0

        entryNodes.forEach(entry => {
          const text = (entry.dataset.search || '').toLowerCase()
          const matched = !keyword || text.indexOf(keyword) > -1
          entry.classList.toggle('is-hidden', !matched)
          if (matched) visibleCount += 1
        })

        updateCount(visibleCount)
      }

      if (searchInput) {
        searchInput.addEventListener('input', applySearch)
      }

      root.addEventListener('click', async event => {
        const button = event.target.closest('[data-copy]')
        if (!button) return

        const value = button.getAttribute('data-copy') || ''
        if (!value) return

        const originalText = button.textContent

        try {
          await navigator.clipboard.writeText(value)
          button.textContent = '已复制'
        } catch (error) {
          button.textContent = '复制失败'
        }

        window.setTimeout(() => {
          button.textContent = originalText
        }, 1600)
      })

      root.querySelectorAll('.watch-entry__qr-image[data-qr-target]').forEach(image => {
        const target = image.getAttribute('data-qr-target')
        if (!target) return
        image.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(target)
      })

      updateCount(entryNodes.length)
      applySearch()
    } catch (error) {
      if (blankState) blankState.hidden = false
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWatchingLibrary)
  } else {
    initWatchingLibrary()
  }

  document.addEventListener('pjax:complete', initWatchingLibrary)
})()

