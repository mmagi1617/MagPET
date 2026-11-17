import { supabase } from './supabase.js'

export const CATEGORY_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'saving', label: 'Saving' },
]

export function normalizeCategoryName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

export function getCategoryDepth(categoryId, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const visited = new Set([categoryId])
  let current = byId.get(categoryId)
  let depth = 0

  while (current?.parent_id && !visited.has(current.parent_id)) {
    visited.add(current.parent_id)
    current = byId.get(current.parent_id)
    if (current && current.transaction_type !== byId.get(categoryId)?.transaction_type) break
    if (!current) break
    depth += 1
  }

  return depth
}

export function getDescendantCategoryIds(categoryId, categories) {
  const descendants = new Set()
  const pending = [categoryId]

  while (pending.length) {
    const parentId = pending.pop()
    for (const category of categories) {
      if (category.parent_id === parentId && !descendants.has(category.id)) {
        descendants.add(category.id)
        pending.push(category.id)
      }
    }
  }

  return descendants
}

export function getCategoryPath(category, categories) {
  const parts = [category.name]
  const visited = new Set([category.id])
  let parentId = category.parent_id

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = categories.find(
      (item) => item.id === parentId && item.transaction_type === category.transaction_type,
    )
    if (!parent) break
    parts.unshift(parent.name)
    parentId = parent.parent_id
  }

  return parts.join(' / ')
}

export async function fetchCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,name,parent_id,created_at,transaction_type')
    .eq('user_id', userId)

  if (error) throw error
  return data ?? []
}

async function assertParent(userId, categoryType, parentId, categoryId) {
  if (!parentId) return
  if (parentId === categoryId) throw new Error('A category cannot be its own parent.')

  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('transaction_type', categoryType)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Choose a parent category owned by you with the same category type.')
}

async function assertUniqueName(userId, categoryType, name, categoryId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id,name')
    .eq('user_id', userId)
    .eq('transaction_type', categoryType)

  if (error) throw error

  const normalized = normalizeCategoryName(name).toLowerCase()
  const duplicate = (data ?? []).some(
    (category) => category.id !== categoryId &&
      normalizeCategoryName(category.name).toLowerCase() === normalized,
  )

  if (duplicate) throw new Error('A category with this name already exists for this type.')
}

async function getUsage(userId, categoryId) {
  const [expensesResult, savingsResult, childrenResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', categoryId),
    supabase
      .from('savings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', categoryId),
    supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('parent_id', categoryId),
  ])

  const error = expensesResult.error || savingsResult.error || childrenResult.error
  if (error) throw error

  return {
    expenses: expensesResult.count ?? 0,
    savings: savingsResult.count ?? 0,
    children: childrenResult.count ?? 0,
  }
}

export async function saveCategory(userId, values, existingCategories, categoryId) {
  const name = normalizeCategoryName(values.name)
  const transactionType = values.transaction_type

  if (!name) throw new Error('Enter a category name.')
  if (!CATEGORY_TYPES.some((type) => type.value === transactionType)) {
    throw new Error('Choose Expense or Saving as the category type.')
  }

  const parentId = values.parent_id || null
  const descendants = categoryId
    ? getDescendantCategoryIds(categoryId, existingCategories)
    : new Set()
  if (parentId && descendants.has(parentId)) {
    throw new Error('A category cannot be moved under one of its own subcategories.')
  }

  await Promise.all([
    assertParent(userId, transactionType, parentId, categoryId),
    assertUniqueName(userId, transactionType, name, categoryId),
  ])

  if (categoryId) {
    const current = existingCategories.find((category) => category.id === categoryId)
    if (!current) throw new Error('This category is no longer available.')

    if (current.transaction_type !== transactionType) {
      const usage = await getUsage(userId, categoryId)
      if (usage.expenses || usage.savings) {
        throw new Error('This category is already used by saved records, so its type cannot be changed.')
      }
      if (usage.children) {
        throw new Error('This category has subcategories. Reassign them before changing its type.')
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .update({
        name,
        parent_id: parentId,
        transaction_type: transactionType,
      })
      .eq('id', categoryId)
      .eq('user_id', userId)
      .select('id,user_id,name,parent_id,created_at,transaction_type')
      .single()

    if (error?.code === '23505') throw new Error('A category with this name already exists for this type.')
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
      transaction_type: transactionType,
    })
    .select('id,user_id,name,parent_id,created_at,transaction_type')
    .single()

  if (error?.code === '23505') throw new Error('A category with this name already exists for this type.')
  if (error) throw error
  return data
}

export async function deleteCategory(userId, categoryId) {
  const usage = await getUsage(userId, categoryId)
  if (usage.children) {
    throw new Error('This category has subcategories. Reassign or delete those categories first.')
  }
  if (usage.expenses || usage.savings) {
    throw new Error('This category is in use by saved records. Reassign those records before deleting it.')
  }

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error?.code === '23503') {
    throw new Error('This category is still referenced by records. Reassign those records before deleting it.')
  }
  if (error) throw error
  if (!data) throw new Error('This category could not be found or is no longer available.')
  return data
}
