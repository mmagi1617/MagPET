import { useEffect, useMemo, useState } from 'react'
import { FolderTree, Pencil, Plus, Search, Tags, Trash2, Wallet, X } from 'lucide-react'
import CategoryForm from '../components/CategoryForm.jsx'
import { useAuth } from '../context/useAuth.js'
import {
  CATEGORY_TYPES,
  deleteCategory,
  fetchCategories,
  getCategoryDepth,
  getCategoryPath,
  getDescendantCategoryIds,
  saveCategory,
} from '../lib/categories.js'
import { formatExpenseDate } from '../lib/format.js'
import '../styles/categories.css'
import '../styles/expenses.css'

const INITIAL_FILTERS = { type: 'all', structure: 'all', search: '', sort: 'az' }

function categoryTypeLabel(type) {
  return CATEGORY_TYPES.find((item) => item.value === type)?.label ?? 'Unknown'
}

function sortTree(categories, sort) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const childrenByParent = new Map()

  for (const category of categories) {
    const parent = category.parent_id ? byId.get(category.parent_id) : null
    const parentId = parent?.transaction_type === category.transaction_type ? parent.id : null
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(category)
    childrenByParent.set(parentId, siblings)
  }

  const comparator = (left, right) => {
    if (sort === 'za') return right.name.localeCompare(left.name)
    if (sort === 'recent') return (right.created_at || '').localeCompare(left.created_at || '')
    if (sort === 'oldest') return (left.created_at || '').localeCompare(right.created_at || '')
    return left.name.localeCompare(right.name)
  }

  const flattened = []
  const visited = new Set()
  function visit(category, depth) {
    if (visited.has(category.id)) return
    visited.add(category.id)
    flattened.push({ ...category, depth, path: getCategoryPath(category, categories) })
    const children = [...(childrenByParent.get(category.id) ?? [])].sort(comparator)
    children.forEach((child) => visit(child, depth + 1))
  }

  const roots = [...(childrenByParent.get(null) ?? [])].sort(comparator)
  roots.forEach((category) => visit(category, 0))
  categories.filter((category) => !visited.has(category.id)).sort(comparator)
    .forEach((category) => visit(category, getCategoryDepth(category.id, categories)))

  return flattened
}

function Categories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [operationError, setOperationError] = useState('')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [modalCategory, setModalCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const rows = await fetchCategories(user.id)
        if (active) setCategories(rows)
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load your categories.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [refreshKey, user.id])

  const summary = useMemo(() => ({
    all: categories.length,
    expense: categories.filter((category) => category.transaction_type === 'expense').length,
    saving: categories.filter((category) => category.transaction_type === 'saving').length,
    parents: categories.filter((category) => !category.parent_id).length,
    children: categories.filter((category) => Boolean(category.parent_id)).length,
  }), [categories])

  const visibleCategories = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return sortTree(categories, filters.sort).filter((category) => {
      if (filters.type !== 'all' && category.transaction_type !== filters.type) return false
      if (filters.structure === 'parents' && category.parent_id) return false
      if (filters.structure === 'children' && !category.parent_id) return false
      if (search && !category.name.toLowerCase().includes(search)) return false
      return true
    })
  }, [categories, filters])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  async function handleSave(values) {
    if (saving) return
    setSaving(true)
    setOperationError('')
    try {
      await saveCategory(user.id, values, categories, modalCategory?.id)
      const wasEditing = Boolean(modalCategory?.id)
      setModalCategory(null)
      setRefreshKey((value) => value + 1)
      showToast(wasEditing ? 'Category updated.' : 'Category added.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setOperationError('')
    try {
      await deleteCategory(user.id, deleteTarget.id)
      setDeleteTarget(null)
      setRefreshKey((value) => value + 1)
      showToast('Category deleted.')
    } catch (error) {
      setOperationError(error.message || 'Unable to delete this category.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function openEdit(category) {
    setOperationError('')
    setModalCategory({
      ...category,
      descendantIds: [...getDescendantCategoryIds(category.id, categories)],
    })
  }

  const categoryModalKey = modalCategory?.id ?? 'new-category'

  return (
    <div className="app-shell">
      <main className="expense-page category-page">
        <section className="expense-page__intro">
          <div>
            <p className="eyebrow">KEEP THINGS ORGANIZED</p>
            <h1>Categories</h1>
            <p>Group spending and savings into categories that make sense to you.</p>
          </div>
          <button className="button button--primary" onClick={() => { setOperationError(''); setModalCategory({}) }} type="button"><Plus size={17} /> Add category</button>
        </section>

        {loadError && <p className="form-message form-message--error expense-page__alert" role="alert">{loadError}</p>}
        {operationError && <p className="form-message form-message--error expense-page__alert" role="alert">{operationError}</p>}

        <section aria-label="Category summary" className="category-summary-grid">
          <article className="category-metric"><span><Tags size={19} /></span><div><p>Total categories</p><strong>{loading ? '—' : summary.all}</strong></div></article>
          <article className="category-metric category-metric--expense"><span><Wallet size={19} /></span><div><p>Expense categories</p><strong>{loading ? '—' : summary.expense}</strong></div></article>
          <article className="category-metric category-metric--saving"><span><Wallet size={19} /></span><div><p>Saving categories</p><strong>{loading ? '—' : summary.saving}</strong></div></article>
          <article className="category-metric"><span><FolderTree size={19} /></span><div><p>Parent categories</p><strong>{loading ? '—' : summary.parents}</strong></div></article>
          <article className="category-metric"><span className="category-metric__branch">↳</span><div><p>Subcategories</p><strong>{loading ? '—' : summary.children}</strong></div></article>
        </section>

        <section aria-labelledby="category-list-title" className="expense-panel category-panel">
          <div className="expense-history__heading">
            <div><p className="eyebrow">YOUR CATEGORY LIBRARY</p><h2 id="category-list-title">Manage categories</h2></div>
            <span className="expense-history__count">{visibleCategories.length} shown</span>
          </div>

          <div className="category-toolbar">
            <div aria-label="Category type" className="category-tabs" role="group">
              {[
                ['all', 'All categories'],
                ['expense', 'Expenses'],
                ['saving', 'Savings'],
              ].map(([value, label]) => (
                <button aria-pressed={filters.type === value} className={filters.type === value ? 'category-tab category-tab--active' : 'category-tab'} key={value} onClick={() => updateFilter('type', value)} type="button">{label}</button>
              ))}
            </div>
            <label className="category-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search category names</span><input maxLength={80} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search categories" value={filters.search} />{filters.search && <button aria-label="Clear category search" onClick={() => updateFilter('search', '')} type="button"><X size={15} /></button>}</label>
            <label className="expense-filter category-toolbar__filter"><span>Show</span><select onChange={(event) => updateFilter('structure', event.target.value)} value={filters.structure}><option value="all">Parents & subcategories</option><option value="parents">Parent categories</option><option value="children">Subcategories</option></select></label>
            <label className="expense-filter category-toolbar__sort"><span>Sort</span><select onChange={(event) => updateFilter('sort', event.target.value)} value={filters.sort}><option value="az">Alphabetical A–Z</option><option value="za">Alphabetical Z–A</option><option value="recent">Recently created</option><option value="oldest">Oldest first</option></select></label>
            <button className="expense-reset" onClick={() => setFilters(INITIAL_FILTERS)} type="button">Reset filters</button>
          </div>

          <div aria-live="polite" className="category-list-wrap">
            {loading ? (
              <div className="expense-state"><span className="loading-spinner" /><p>Loading your categories…</p></div>
            ) : visibleCategories.length === 0 ? (
              <div className="expense-state"><span className="expense-state__symbol"><Tags size={20} /></span><h3>{categories.length ? 'No categories match these filters' : 'Your category library is empty'}</h3><p>{categories.length ? 'Try a different search or reset the filters.' : 'Add an expense or savings category to start organizing.'}</p>{!categories.length && <button className="button button--outline" onClick={() => setModalCategory({})} type="button"><Plus size={15} /> Add your first category</button>}</div>
            ) : (
              <div className="category-list">
                <div className="category-list__head"><span>Category</span><span>Type</span><span>Parent</span><span>Created</span><span><span className="sr-only">Actions</span></span></div>
                {visibleCategories.map((category) => {
                  const parent = categories.find((item) => item.id === category.parent_id)
                  const depth = Math.min(category.depth, 5)
                  return (
                    <article className="category-row" key={category.id}>
                      <div className="category-row__name" style={{ '--category-depth': depth }}>
                        {depth > 0 && <span aria-hidden="true" className="category-row__branch">↳</span>}
                        <span><strong>{category.name}</strong><small>{category.path}</small></span>
                      </div>
                      <div className="category-row__type"><span className={`category-type-pill category-type-pill--${category.transaction_type}`}>{categoryTypeLabel(category.transaction_type)}</span></div>
                      <div className="category-row__parent"><span className="category-mobile-label">Parent</span>{parent?.transaction_type === category.transaction_type ? parent.name : '—'}</div>
                      <div className="category-row__date"><span className="category-mobile-label">Created</span>{formatExpenseDate(category.created_at?.slice(0, 10))}</div>
                      <div className="category-row__actions"><button aria-label={`Edit ${category.name}`} onClick={() => openEdit(category)} type="button"><Pencil size={16} /></button><button aria-label={`Delete ${category.name}`} onClick={() => setDeleteTarget(category)} type="button"><Trash2 size={16} /></button></div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {modalCategory && (
        <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalCategory(null) }}>
          <section aria-label={modalCategory.id ? 'Edit category' : 'Add category'} aria-modal="true" className="expense-modal category-modal" role="dialog">
            <button aria-label="Close category form" className="expense-modal__close" disabled={saving} onClick={() => setModalCategory(null)} type="button"><X size={19} /></button>
            <div className="expense-section-heading"><div><p className="eyebrow">{modalCategory.id ? 'UPDATE CATEGORY' : 'MAKE IT YOURS'}</p><h2>{modalCategory.id ? 'Edit category' : 'Add a category'}</h2></div></div>
            <CategoryForm
              categories={categories}
              initialValues={modalCategory.id ? modalCategory : null}
              key={categoryModalKey}
              onCancel={() => setModalCategory(null)}
              onSubmit={handleSave}
              submitting={saving}
            />
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null) }}>
          <section aria-labelledby="delete-category-title" aria-modal="true" className="expense-confirm" role="alertdialog">
            <button aria-label="Cancel deletion" className="expense-modal__close" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button"><X size={19} /></button>
            <span className="expense-confirm__icon"><Trash2 size={20} /></span>
            <p className="eyebrow">REMOVE CATEGORY</p>
            <h2 id="delete-category-title">Delete “{deleteTarget.name}”?</h2>
            <p>We’ll check for child categories and linked expense or savings records before deleting. Existing records will never be removed.</p>
            <div className="expense-form__actions"><button className="button button--outline" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="button expense-delete-button" disabled={deleting} onClick={handleDelete} type="button">{deleting ? 'Checking and deleting…' : 'Delete category'}</button></div>
          </section>
        </div>
      )}

      {toast && <div className="expense-toast" role="status">{toast}</div>}
    </div>
  )
}

export default Categories
