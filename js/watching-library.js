(function () {
  const searchKeys = [
    'resource_type',
    'title',
    'translated_title',
    'original_title',
    'english_title',
    'year',
    'country',
    'language',
    'director',
    'writer',
    'summary'
  ]

  const fieldRows = [
    ['译名', item => item.translated_title || item.title],
    ['片名', item => item.original_title || item.english_title],
    ['年代', item => item.year],
    ['产地', item => item.country],
    ['类别', item => formatJoined(item.genre)],
    ['语言', item => item.language],
    ['上映日期', item => item.release_date],
    ['IMDb评分', item => item.imdb_rating],
    ['IMDb链接', item => item.imdb_url],
    ['豆瓣评分', item => item.douban_rating],
    ['豆瓣链接', item => item.douban_url],
    ['片长', item => item.runtime],
    ['导演', item => item.director],
    ['编剧', item => item.writer],
    ['主演', item => formatJoined(item.cast)],
    ['简介', item => item.summary],
    ['获奖情况', item => formatLines(item.awards)]
  ]

  const toArray = value => {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (value === null || value === undefined || value === '') return []
    return [value]
  }

  const formatJoined = value => toArray(value).join(' / ')
  const formatLines = value => toArray(value).join('\n')
  const isAbsoluteUrl = value => /^https?:\/\//i.test(String(value || ''))
  const getResourceType = item => item.resource_type || item.type || '影视'
  const getEntryTitle = (item, index) => item.title || item.translated_title || ('未命名条目 ' + (index + 1))

  const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const resolvePublicUrl = value => {
    const text = String(value || '').trim()
    if (!text) return ''
    if (isAbsoluteUrl(text)) return text

    try {
      return new URL(text, window.location.origin).toString()
    } catch (error) {
      return text
    }
  }

  const getDateSortValue = value => {
    const text = String(value || '').trim()
    if (!text) return 0

    const parsed = Date.parse(text.replace(' ', 'T'))
    if (!Number.isNaN(parsed)) return parsed

    const numeric = Number(text.replace(/\D/g, ''))
    return Number.isFinite(numeric) ? numeric : 0
  }

  const buildSearchText = item => searchKeys
    .map(key => item[key])
    .concat(item.genre || [], item.cast || [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const createTagMarkup = (values, className) => toArray(values)
    .map(value => '<span class="' + className + '">' + escapeHtml(value) + '</span>')
    .join('')

  const createInfoRows = item => fieldRows.map(([label, getter]) => {
    const value = getter(item)
    if (!value) return ''

    const text = String(value)
    const isLink = /^https?:\/\//i.test(text)
    const valueMarkup = isLink
      ? '<a href="' + escapeHtml(text) + '" target="_blank" rel="noopener external nofollow">' + escapeHtml(text) + '</a>'
      : escapeHtml(text).replace(/\n/g, '<br>')

    return [
      '<div class="watch-entry__row">',
      '  <div class="watch-entry__label"><span class="watch-entry__dot">◎</span><span>' + escapeHtml(label) + '</span></div>',
      '  <div class="watch-entry__value">' + valueMarkup + '</div>',
      '</div>'
    ].join('')
  }).filter(Boolean).join('')

  const createActionMarkup = actions => actions.map(action => {
    const kind = action.kind || 'default'
    const url = resolvePublicUrl(action.url)
    return '<a class="watch-entry__action watch-entry__action--' + escapeHtml(kind) + '" href="' + escapeHtml(url) + '" target="_blank" rel="noopener external nofollow">' + escapeHtml(action.label) + '</a>'
  }).join('')

  const createBreadcrumbMarkup = item => {
    const trail = [
      { label: '首页', url: '/' },
      { label: 'Watching', url: '/watching/' },
      { label: getResourceType(item), url: '/watching/' },
      { label: item.translated_title || item.title || '影视详情' }
    ]

    const links = trail.map((crumb, index) => {
      const isLast = index === trail.length - 1
      const prefix = index === 0 ? '<i class="fas fa-house" aria-hidden="true"></i>' : ''
      const content = prefix + '<span>' + escapeHtml(crumb.label) + '</span>'

      return isLast || !crumb.url
        ? '<span class="watch-entry__crumb watch-entry__crumb--current">' + content + '</span>'
        : '<a class="watch-entry__crumb" href="' + escapeHtml(resolvePublicUrl(crumb.url)) + '">' + content + '</a>'
    }).join('<span class="watch-entry__crumb-sep">&gt;</span>')

    return '<nav class="watch-entry__breadcrumbs" aria-label="面包屑导航">' + links + '</nav>'
  }

  const createDirectoryItemMarkup = (item, index) => {
    const entryId = item.id || ('watch-entry-' + (index + 1))
    const title = getEntryTitle(item, index)
    const detailUrl = item.detail_url ? resolvePublicUrl(item.detail_url) : ''
    const typeLabel = getResourceType(item)
    const metaLine = [item.original_title || item.english_title, item.year, item.country, formatJoined(item.genre), item.language].filter(Boolean).join(' / ')
    const tags = createTagMarkup(toArray(item.genre).slice(0, 4), 'watch-directory__tag')
    const updatedMarkup = item.updated_at
      ? '<span class="watch-directory__updated">整理于 ' + escapeHtml(item.updated_at) + '</span>'
      : ''

    return [
      '<article class="watch-directory__item" id="' + escapeHtml(entryId) + '" data-watch-entry data-filter="' + escapeHtml(typeLabel) + '" data-search="' + escapeHtml(buildSearchText(item)) + '">',
      '  <div class="watch-directory__badge">' + escapeHtml(typeLabel) + '</div>',
      '  <div class="watch-directory__body">',
      '    <div class="watch-directory__topline">',
      detailUrl
        ? '      <h3 class="watch-directory__title"><a href="' + escapeHtml(detailUrl) + '">' + escapeHtml(title) + '</a></h3>'
        : '      <h3 class="watch-directory__title">' + escapeHtml(title) + '</h3>',
      updatedMarkup ? '      ' + updatedMarkup : '',
      '    </div>',
      metaLine ? '    <p class="watch-directory__meta">' + escapeHtml(metaLine) + '</p>' : '',
      tags ? '    <div class="watch-directory__tags">' + tags + '</div>' : '',
      item.summary ? '    <p class="watch-directory__summary">' + escapeHtml(item.summary) + '</p>' : '',
      '  </div>',
      detailUrl ? '  <a class="watch-directory__open" href="' + escapeHtml(detailUrl) + '">进入详情</a>' : '',
      '</article>'
    ].filter(Boolean).join('')
  }

  const createDetailMarkup = (item, index) => {
    const entryId = item.id || ('watch-entry-' + (index + 1))
    const title = getEntryTitle(item, index)
    const resourceLinks = Array.isArray(item.resource_links) ? item.resource_links.filter(action => action && action.label && action.url) : []
    const qrTarget = resolvePublicUrl(item.qr_target || item.copy_text || item.detail_url || (resourceLinks[0] && resourceLinks[0].url) || '')
    const copyValue = resolvePublicUrl(item.copy_text || qrTarget)
    const typeLabel = getResourceType(item)
    const subtitle = [item.original_title || item.english_title, item.year, item.country].filter(Boolean).join(' / ')
    const chipMarkup = createTagMarkup(toArray(item.genre).slice(0, 5), 'watch-entry__chip')
    const actionMarkup = resourceLinks.length || copyValue
      ? '<div class="watch-entry__actions">' + createActionMarkup(resourceLinks) + (copyValue ? '<button class="watch-entry__action watch-entry__action--copy" type="button" data-copy="' + escapeHtml(copyValue) + '">复制</button>' : '') + '</div>'
      : ''
    const qrMarkup = qrTarget
      ? '<img class="watch-entry__qr-image" data-qr-target="' + escapeHtml(qrTarget) + '" alt="' + escapeHtml(title + ' 二维码') + '" loading="lazy"><p class="watch-entry__qr-text">手机扫一扫，获得更好体验</p>'
      : '<div class="watch-entry__qr-empty"><i class="fas fa-qrcode" aria-hidden="true"></i><span>补充链接后自动生成二维码</span></div>'

    return [
      '<section class="watch-detail" id="' + escapeHtml(entryId) + '" data-watch-entry data-filter="' + escapeHtml(typeLabel) + '" data-search="' + escapeHtml(buildSearchText(item)) + '">',
      '  ' + createBreadcrumbMarkup(item),
      '  <article class="watch-entry">',
      '    <div class="watch-entry__titlebar">',
      '      <h3 class="watch-entry__title">' + escapeHtml(title) + '</h3>',
      subtitle ? '      <p class="watch-entry__subtitle">' + escapeHtml(subtitle) + '</p>' : '',
      '      <div class="watch-entry__chips"><span class="watch-entry__chip watch-entry__chip--type">' + escapeHtml(typeLabel) + '</span>' + chipMarkup + '</div>',
      '    </div>',
      '    <div class="watch-entry__panel">',
      '      <div class="watch-entry__meta">',
      '        <div class="watch-entry__section-head">',
      '          <div class="watch-entry__section-label">资源类型</div>',
      '          <div class="watch-entry__section-value">' + escapeHtml(typeLabel) + '</div>',
      '        </div>',
      '        <div class="watch-entry__rows">' + createInfoRows(item) + '</div>',
      '        <div class="watch-entry__updated"><span class="watch-entry__section-label">更新时间</span><span class="watch-entry__section-value">' + escapeHtml(item.updated_at || '待更新') + '</span></div>',
      actionMarkup ? '        <div class="watch-entry__resource-line"><span class="watch-entry__section-label">资源地址</span>' + actionMarkup + '</div>' : '',
      '      </div>',
      '      <aside class="watch-entry__qr">' + qrMarkup + '</aside>',
      '    </div>',
      '  </article>',
      '</section>'
    ].filter(Boolean).join('')
  }

  const setText = (node, value) => {
    if (node) node.textContent = String(value)
  }

  const hideDetailPageTitle = root => {
    const pageNode = root.closest('#page')
    if (!pageNode) return

    const titleNode = Array.from(pageNode.children).find(node => node.classList && node.classList.contains('page-title'))
    if (titleNode) titleNode.style.display = 'none'

    pageNode.classList.add('page--watching-detail')
  }

  const initWatchingLibrary = async () => {
    const root = document.querySelector('#watching-library')
    if (!root || root.dataset.enhanced === 'true') return

    root.dataset.enhanced = 'true'

    const source = root.dataset.source
    const entryId = root.dataset.entryId || ''
    const mode = root.dataset.mode || (entryId ? 'detail' : 'list')
    const listNode = root.querySelector('[data-watching-list]')
    const searchInput = root.querySelector('[data-watching-search]')
    const filtersNode = root.querySelector('[data-watching-filters]')
    const emptyState = root.querySelector('[data-watching-empty]')
    const blankState = root.querySelector('[data-watching-blank]')
    const countNode = root.querySelector('[data-watch-count]')
    const totalNode = root.querySelector('[data-watch-total]')
    const typeNode = root.querySelector('[data-watch-types]')
    const resourceNode = root.querySelector('[data-watch-resources]')
    const latestNode = root.querySelector('[data-watch-updated]')

    let activeFilter = 'all'

    if (!source || !listNode) return

    root.classList.toggle('watching-library--detail', mode === 'detail')
    root.classList.toggle('watching-library--directory', mode !== 'detail')

    if (mode === 'detail') hideDetailPageTitle(root)
    if (filtersNode) filtersNode.hidden = mode === 'detail'

    try {
      const response = await fetch(source, { cache: 'no-store' })
      if (!response.ok) throw new Error('watching library fetch failed')

      const payload = await response.json()
      const allEntries = Array.isArray(payload.entries) ? payload.entries : []
      const filteredById = entryId ? allEntries.filter(item => item.id === entryId) : allEntries.slice()
      const entries = mode === 'list'
        ? filteredById.sort((left, right) => getDateSortValue(right.updated_at) - getDateSortValue(left.updated_at))
        : filteredById
      const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {}
      const latestUpdatedAt = allEntries.reduce((result, item) => {
        if (!item || !item.updated_at) return result
        return !result || String(item.updated_at) > String(result) ? item.updated_at : result
      }, '')
      const resourceCount = allEntries.reduce((result, item) => {
        const count = Array.isArray(item && item.resource_links) ? item.resource_links.length : 0
        return result + count
      }, 0)
      const typeList = Array.from(new Set(allEntries.map(getResourceType))).filter(Boolean)
      const sortedTypeList = typeList.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))

      if (searchInput && meta.search_placeholder) searchInput.placeholder = meta.search_placeholder
      if (emptyState) {
        emptyState.dataset.emptyText = meta.empty_text || root.dataset.emptyText || '没有找到匹配的影视条目。'
        const textNode = emptyState.querySelector('p')
        if (textNode) textNode.textContent = emptyState.dataset.emptyText
      }

      setText(totalNode, allEntries.length)
      setText(countNode, entries.length)
      setText(typeNode, sortedTypeList.length)
      setText(resourceNode, resourceCount)
      setText(latestNode, latestUpdatedAt || '待更新')

      if (filtersNode && mode === 'list') {
        filtersNode.hidden = sortedTypeList.length === 0
        filtersNode.innerHTML = ['<button class="watch-filter is-active" type="button" data-filter="all">全部</button>']
          .concat(sortedTypeList.map(type => '<button class="watch-filter" type="button" data-filter="' + escapeHtml(type) + '">' + escapeHtml(type) + '</button>'))
          .join('')
      }

      if (!entries.length) {
        if (blankState) blankState.hidden = false
        listNode.innerHTML = ''
        return
      }

      listNode.innerHTML = mode === 'detail'
        ? entries.map(createDetailMarkup).join('')
        : entries.map(createDirectoryItemMarkup).join('')

      const entryNodes = Array.from(listNode.querySelectorAll('[data-watch-entry]'))

      const updateCount = visibleCount => {
        if (countNode) countNode.textContent = String(visibleCount)
        if (emptyState) emptyState.hidden = visibleCount !== 0
      }

      const applyFilters = () => {
        const keyword = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase()
        let visibleCount = 0

        entryNodes.forEach(entry => {
          const text = (entry.dataset.search || '').toLowerCase()
          const filterLabel = entry.dataset.filter || ''
          const matchedFilter = activeFilter === 'all' || filterLabel === activeFilter
          const matchedKeyword = !keyword || text.indexOf(keyword) > -1
          const matched = matchedFilter && matchedKeyword

          entry.classList.toggle('is-hidden', !matched)
          if (matched) visibleCount += 1
        })

        updateCount(visibleCount)
      }

      if (searchInput) searchInput.addEventListener('input', applyFilters)

      if (filtersNode && mode === 'list') {
        filtersNode.addEventListener('click', event => {
          const button = event.target.closest('[data-filter]')
          if (!button) return

          activeFilter = button.getAttribute('data-filter') || 'all'
          filtersNode.querySelectorAll('[data-filter]').forEach(node => {
            node.classList.toggle('is-active', node === button)
          })
          applyFilters()
        })
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
      applyFilters()
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
