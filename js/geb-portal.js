(() => {
  'use strict'

  const q = (selector, root = document) => root.querySelector(selector)
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector))

  const create = (tag, className, text) => {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  const makeArticleRow = (article, compact = false) => {
    const item = create('article', compact ? 'geb-library-article is-compact' : 'geb-library-article')
    const main = create('div', 'geb-library-article__main')
    const link = create('a', 'geb-library-article__title', article.title)
    link.href = article.href
    main.appendChild(link)

    const meta = create('div', 'geb-library-article__meta')
    meta.appendChild(create('time', '', article.dateOnly || article.date || ''))

    const labels = [...(article.categories || []).slice(0, 2), ...(article.tags || []).slice(0, compact ? 1 : 2)]
    labels.forEach(label => meta.appendChild(create('span', 'geb-library-article__label', label)))
    main.appendChild(meta)
    item.appendChild(main)

    const arrow = create('span', 'geb-library-article__arrow', '→')
    arrow.setAttribute('aria-hidden', 'true')
    item.appendChild(arrow)
    return item
  }

  const initPortal = root => {
    if (!root || root.dataset.gebPortalReady === 'true') return

    const dataNode = q('[data-geb-library-data]')
    if (!dataNode) return

    let data
    try {
      data = JSON.parse(dataNode.textContent || '{}')
    } catch (error) {
      root.textContent = 'GEB 知识库索引加载失败。'
      return
    }

    const articles = Array.isArray(data.articles) ? data.articles : []
    const categories = Array.isArray(data.categories) ? data.categories : []
    const tags = Array.isArray(data.tags) ? data.tags : []

    root.dataset.gebPortalReady = 'true'
    root.innerHTML = [
      '<section class="geb-library-shell">',
      '  <div class="geb-library-heading">',
      '    <div>',
      '      <p class="geb-library-eyebrow">Unlocked GEB Library</p>',
      '      <h2>知识库索引</h2>',
      '      <p>在同一标签页中解锁一次后，可连续浏览 GEB 分类、标签和文章，无需逐篇重新输入密码。</p>',
      '    </div>',
      '    <div class="geb-library-stats" data-geb-library-stats></div>',
      '  </div>',
      '  <nav class="geb-library-tabs" aria-label="GEB 知识库导航">',
      '    <button type="button" class="is-active" data-geb-library-tab="latest">最新发布</button>',
      '    <button type="button" data-geb-library-tab="categories">分类</button>',
      '    <button type="button" data-geb-library-tab="tags">标签</button>',
      '    <button type="button" data-geb-library-tab="all">全部文章</button>',
      '  </nav>',
      '  <div class="geb-library-panel is-active" data-geb-library-panel="latest"></div>',
      '  <div class="geb-library-panel" data-geb-library-panel="categories"></div>',
      '  <div class="geb-library-panel" data-geb-library-panel="tags"></div>',
      '  <div class="geb-library-panel" data-geb-library-panel="all"></div>',
      '  <div class="geb-library-panel" data-geb-library-panel="detail"></div>',
      '</section>'
    ].join('')

    const stats = q('[data-geb-library-stats]', root)
    ;[
      [articles.length, '篇文章'],
      [categories.length, '个分类'],
      [tags.length, '个标签']
    ].forEach(([value, label]) => {
      const card = create('div', 'geb-library-stat')
      card.appendChild(create('strong', '', String(value)))
      card.appendChild(create('span', '', label))
      stats.appendChild(card)
    })

    const latestPanel = q('[data-geb-library-panel="latest"]', root)
    const latestHead = create('div', 'geb-library-section-head')
    latestHead.appendChild(create('h3', '', '最新发布'))
    latestHead.appendChild(create('span', '', `最近更新的 ${Math.min(12, articles.length)} 篇`))
    latestPanel.appendChild(latestHead)
    const latestList = create('div', 'geb-library-article-list')
    articles.slice(0, 12).forEach(article => latestList.appendChild(makeArticleRow(article, true)))
    latestPanel.appendChild(latestList)

    const categoriesPanel = q('[data-geb-library-panel="categories"]', root)
    const categoryHead = create('div', 'geb-library-section-head')
    categoryHead.appendChild(create('h3', '', 'GEB 分类'))
    categoryHead.appendChild(create('span', '', '解锁后查看各分类及其完整文章列表'))
    categoriesPanel.appendChild(categoryHead)
    const categoryGrid = create('div', 'geb-library-taxonomy-grid')
    categories.forEach(entry => {
      const button = create('button', 'geb-library-taxonomy')
      button.type = 'button'
      button.dataset.filterKind = 'category'
      button.dataset.filterValue = entry.name
      button.appendChild(create('span', '', entry.name))
      button.appendChild(create('strong', '', String(entry.count)))
      categoryGrid.appendChild(button)
    })
    categoriesPanel.appendChild(categoryGrid)

    const tagsPanel = q('[data-geb-library-panel="tags"]', root)
    const tagsHead = create('div', 'geb-library-section-head')
    tagsHead.appendChild(create('h3', '', 'GEB 标签'))
    tagsHead.appendChild(create('span', '', '保留原始细粒度知识标签，点击进入标签详情'))
    tagsPanel.appendChild(tagsHead)
    const tagCloud = create('div', 'geb-library-tag-cloud')
    tags.forEach(entry => {
      const button = create('button', 'geb-library-tag')
      button.type = 'button'
      button.dataset.filterKind = 'tag'
      button.dataset.filterValue = entry.name
      button.appendChild(create('span', '', entry.name))
      button.appendChild(create('small', '', String(entry.count)))
      tagCloud.appendChild(button)
    })
    tagsPanel.appendChild(tagCloud)

    const allPanel = q('[data-geb-library-panel="all"]', root)
    const toolbar = create('div', 'geb-library-toolbar')
    const search = create('input', 'geb-library-search')
    search.type = 'search'
    search.placeholder = '搜索标题、分类或标签…'
    search.setAttribute('aria-label', '搜索 GEB 文章')
    const filterBox = create('div', 'geb-library-filter')
    const filterText = create('span', 'geb-library-filter__text', '全部文章')
    const clearFilter = create('button', 'geb-library-filter__clear', '清除筛选')
    clearFilter.type = 'button'
    clearFilter.hidden = true
    filterBox.append(filterText, clearFilter)
    toolbar.append(search, filterBox)
    allPanel.appendChild(toolbar)

    const resultSummary = create('div', 'geb-library-result-summary')
    const allList = create('div', 'geb-library-article-list')
    allPanel.append(resultSummary, allList)

    const detailPanel = q('[data-geb-library-panel="detail"]', root)

    let activeFilter = null

    const switchTab = name => {
      qa('[data-geb-library-tab]', root).forEach(button => {
        const active = button.dataset.gebLibraryTab === name
        button.classList.toggle('is-active', active)
        button.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      qa('[data-geb-library-panel]', root).forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.gebLibraryPanel === name)
      })
    }

    const renderTaxonomyDetail = (kind, value) => {
      const isCategory = kind === 'category'
      const matched = articles.filter(article => {
        const values = isCategory ? article.categories || [] : article.tags || []
        return values.includes(value)
      })

      detailPanel.innerHTML = ''

      const nav = create('div', 'geb-library-detail-nav')
      const back = create('button', 'geb-library-detail-back', `← 返回${isCategory ? '分类' : '标签'}`)
      back.type = 'button'
      back.dataset.detailBack = isCategory ? 'categories' : 'tags'
      nav.appendChild(back)
      nav.appendChild(create('span', 'geb-library-detail-kind', isCategory ? '分类详情' : '标签详情'))
      detailPanel.appendChild(nav)

      const hero = create('div', 'geb-library-detail-hero')
      const titleWrap = create('div', 'geb-library-detail-title')
      titleWrap.appendChild(create('p', 'geb-library-detail-eyebrow', isCategory ? 'GEB Category' : 'GEB Tag'))
      titleWrap.appendChild(create('h3', '', value))
      titleWrap.appendChild(create('p', '', `共 ${matched.length} 篇文章，仅在 GEB 解锁状态下可见。`))
      hero.appendChild(titleWrap)

      const count = create('div', 'geb-library-detail-count')
      count.appendChild(create('strong', '', String(matched.length)))
      count.appendChild(create('span', '', '篇文章'))
      hero.appendChild(count)
      detailPanel.appendChild(hero)

      const list = create('div', 'geb-library-article-list geb-library-detail-list')
      matched.forEach(article => list.appendChild(makeArticleRow(article)))
      detailPanel.appendChild(list)
      switchTab('detail')
    }

    const renderAll = () => {
      const query = search.value.trim().toLocaleLowerCase('zh-CN')
      const filtered = articles.filter(article => {
        if (activeFilter) {
          const values = activeFilter.kind === 'category' ? article.categories || [] : article.tags || []
          if (!values.includes(activeFilter.value)) return false
        }

        if (!query) return true
        const haystack = [article.title, ...(article.categories || []), ...(article.tags || [])]
          .join(' ')
          .toLocaleLowerCase('zh-CN')
        return haystack.includes(query)
      })

      allList.innerHTML = ''
      filtered.forEach(article => allList.appendChild(makeArticleRow(article)))
      resultSummary.textContent = `显示 ${filtered.length} / ${articles.length} 篇文章`

      if (activeFilter) {
        filterText.textContent = `${activeFilter.kind === 'category' ? '分类' : '标签'}：${activeFilter.value}`
        clearFilter.hidden = false
      } else {
        filterText.textContent = '全部文章'
        clearFilter.hidden = true
      }
    }

    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-geb-library-tab]')
      if (tab && root.contains(tab)) {
        switchTab(tab.dataset.gebLibraryTab)
        return
      }

      const filter = event.target.closest('[data-filter-kind][data-filter-value]')
      if (filter && root.contains(filter)) {
        renderTaxonomyDetail(filter.dataset.filterKind, filter.dataset.filterValue)
        return
      }

      const detailBack = event.target.closest('[data-detail-back]')
      if (detailBack && root.contains(detailBack)) {
        switchTab(detailBack.dataset.detailBack)
      }
    })

    clearFilter.addEventListener('click', () => {
      activeFilter = null
      renderAll()
    })
    search.addEventListener('input', renderAll)

    renderAll()
  }

  const initAll = () => qa('[data-geb-library-portal]').forEach(initPortal)

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll)
  else initAll()
  window.addEventListener('hexo-blog-decrypt', () => window.setTimeout(initAll, 0))
})()
