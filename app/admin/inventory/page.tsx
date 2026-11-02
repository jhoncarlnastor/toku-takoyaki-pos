'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Link2, Package, PackagePlus, Plus, Trash2, X } from 'lucide-react'
import { EmptySection } from '@/components/admin/empty-section'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

type InventoryItem = {
  id: string
  name: string
  unit: string
  current_stock: number
  min_stock: number
}

type Product = {
  id: string
  name: string
}

type AddOn = {
  id: string
  name: string
  price: number
  applicable_categories?: string[]
}

type ProductRecipe = {
  id: string
  product_id: string | null
  add_on_id: string | null
  inventory_item_id: string
  quantity_required: number
}

type StockStatus = {
  label: string
  className: string
}

type ModalType = 'raw' | 'link' | null

type RawForm = {
  name: string
  unit: string
  current_stock: string
  min_stock: string
}

type LinkForm = {
  item_type: 'product' | 'add_on'
  product_id: string
  add_on_id: string
  inventory_item_id: string
  quantity_required: string
}

const RESTOCK_AMOUNTS = [10, 20, 50]

const EMPTY_RAW_FORM: RawForm = {
  name: '',
  unit: '',
  current_stock: '',
  min_stock: '',
}

const EMPTY_LINK_FORM: LinkForm = {
  item_type: 'product',
  product_id: '',
  add_on_id: '',
  inventory_item_id: '',
  quantity_required: '',
}

function getStockStatus(item: InventoryItem): StockStatus {
  if (item.current_stock <= 0) {
    return { label: 'Out of Stock', className: 'bg-destructive/10 text-destructive' }
  }
  if (item.current_stock <= item.min_stock) {
    return { label: 'Low Stock', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' }
  }
  return { label: 'In Stock', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' }
}

const inputClass =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [recipes, setRecipes] = useState<ProductRecipe[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null)
  const [restockAmount, setRestockAmount] = useState('')
  const [rawForm, setRawForm] = useState<RawForm>(EMPTY_RAW_FORM)
  const [linkForm, setLinkForm] = useState<LinkForm>(EMPTY_LINK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    const { data, error } = await supabase.from('inventory_items').select('*')
    if (error) {
      console.error('Error fetching inventory:', error)
      setError(error.message)
      setItems([])
    } else {
      setItems((data as InventoryItem[]) ?? [])
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*')
    if (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } else {
      setProducts((data as Product[]) ?? [])
    }
  }, [])

  const fetchAddOns = useCallback(async () => {
    const { data, error } = await supabase.from('add_ons').select('id, name, price, applicable_categories')
    if (error) {
      console.error('Error fetching add-ons:', error)
      setAddOns([])
    } else {
      setAddOns((data as AddOn[]) ?? [])
    }
  }, [])

  const fetchRecipes = useCallback(async () => {
    const { data, error } = await supabase.from('product_recipes').select('*')
    if (error) {
      console.error('Error fetching recipes:', error)
      setRecipes([])
    } else {
      setRecipes((data as ProductRecipe[]) ?? [])
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchInventory(), fetchProducts(), fetchAddOns(), fetchRecipes()])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        () => {
          fetchInventory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInventory, fetchProducts, fetchRecipes])

  const refreshAll = useCallback(() => {
    fetchInventory()
    fetchRecipes()
  }, [fetchInventory, fetchRecipes])

  function openRawModal() {
    setRawForm(EMPTY_RAW_FORM)
    setError(null)
    setModalType('raw')
  }

  function openLinkModal(inventoryItemId?: string) {
    setLinkForm({
      ...EMPTY_LINK_FORM,
      inventory_item_id: inventoryItemId ?? '',
    })
    setError(null)
    setModalType('link')
  }

  function closeModal() {
    setModalType(null)
    setError(null)
  }

  function openRestock(item: InventoryItem) {
    setRestockItem(item)
    setRestockAmount('')
    setError(null)
  }

  function closeRestock() {
    setRestockItem(null)
    setRestockAmount('')
    setError(null)
  }

  async function applyRestock(amount: number) {
    if (!restockItem) return
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid stock amount.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ current_stock: restockItem.current_stock + amount })
      .eq('id', restockItem.id)

    if (updateError) {
      console.error('Error restocking:', updateError)
      setError(updateError.message)
    } else {
      closeRestock()
      fetchInventory()
    }
    setSubmitting(false)
  }

  function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault()
    applyRestock(Number(restockAmount))
  }

  async function handleRawSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      name: rawForm.name.trim(),
      unit: rawForm.unit.trim() || 'pcs',
      current_stock: Number(rawForm.current_stock),
      min_stock: Number(rawForm.min_stock),
    }

    if (!payload.name || Number.isNaN(payload.current_stock) || Number.isNaN(payload.min_stock)) {
      setError('Please fill in all fields with valid values.')
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('inventory_items').insert([payload])

    if (insertError) {
      console.error('Error adding raw material:', insertError)
      setError(insertError.message)
    } else {
      closeModal()
      fetchInventory()
    }
    setSubmitting(false)
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      product_id: linkForm.item_type === 'product' ? linkForm.product_id : null,
      add_on_id: linkForm.item_type === 'add_on' ? linkForm.add_on_id : null,
      inventory_item_id: linkForm.inventory_item_id,
      quantity_required: Number(linkForm.quantity_required),
    }

    const hasValidItem = linkForm.item_type === 'product'
      ? !!payload.product_id
      : !!payload.add_on_id

    if (!hasValidItem || !payload.inventory_item_id || Number.isNaN(payload.quantity_required)) {
      setError('Please select a product or add-on, an ingredient, and enter a quantity.')
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('product_recipes').insert([payload])

    if (insertError) {
      console.error('Error saving recipe link:', insertError)
      setError(insertError.message)
    } else {
      closeModal()
      refreshAll()
    }
    setSubmitting(false)
  }

  async function deleteRecipe(recipeId: string) {
    if (!window.confirm('Are you sure you want to remove this recipe link?')) return
    const { error: deleteError } = await supabase.from('product_recipes').delete().eq('id', recipeId)
    if (deleteError) {
      console.error('Error deleting recipe link:', deleteError)
      setError(deleteError.message)
    } else {
      setRecipes((prev) => prev.filter((r) => r.id !== recipeId))
      refreshAll()
    }
  }
  async function deleteRawMaterial(item: InventoryItem) {
    if (!window.confirm(`Are you sure you want to delete raw material "${item.name}"?`)) return

    // 1. Delete linked product_recipes rows associated with this ingredient first
    const { error: recipeError } = await supabase
      .from('product_recipes')
      .delete()
      .eq('inventory_item_id', item.id)

    if (recipeError) {
      console.error('Error deleting related recipes for raw material:', recipeError)
      setError(recipeError.message)
      return
    }

    // 2. Delete the raw material from inventory_items
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id)

    if (error) {
      console.error('Error deleting raw material:', error)
      setError(error.message)
    } else {
      // Immediately update local state without hard refresh
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      refreshAll()
    }
  }

  const formatPeso = (amount: number) => `₱${amount.toFixed(2)}`

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? 'Unknown product'
  const addOnName = (id: string | null) => addOns.find((a) => a.id === id)?.name ?? 'Unknown add-on'
  const itemName = (recipe: ProductRecipe) => {
    if (recipe.product_id) return productName(recipe.product_id)
    if (recipe.add_on_id) return addOnName(recipe.add_on_id)
    return 'Unknown item'
  }
  const ingredientById = (id: string) => items.find((i) => i.id === id)

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Track raw materials and stock levels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openLinkModal()}>
            <Link2 />
            Manage Recipes
          </Button>
          <Button onClick={openRawModal}>
            <Plus data-icon="inline-start" />
            Add Raw Material
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">Loading inventory…</p>
        </div>
      ) : items.length === 0 ? (
        <EmptySection icon={Package} message="No inventory items yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ingredient Name</th>
                <th className="px-4 py-3 font-medium">Current Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const status = getStockStatus(item)
                const linked = recipes.filter((r) => r.inventory_item_id === item.id)
                const expanded = expandedId === item.id
                return (
                  <Fragment key={item.id}>
                    <tr className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="flex items-center gap-2 text-left font-medium hover:text-primary"
                          aria-expanded={expanded}
                        >
                          {expanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                          {item.name}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({linked.length} linked)
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openLinkModal(item.id)}
                            aria-label={`Link ingredient to ${item.name}`}
                          >
                            <Link2 />
                            Link
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => openRestock(item)}
                            aria-label={`Restock ${item.name}`}
                          >
                            <PackagePlus />
                            Restock
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => deleteRawMaterial(item)}
                            className="text-destructive hover:bg-destructive/10"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={4} className="px-4 py-3">
                          {linked.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No products linked to this ingredient yet.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-2 pl-6">
                              {linked.map((recipe) => (
                                <li
                                  key={recipe.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    <span className="font-medium">{itemName(recipe)}</span>
                                    <span className="text-muted-foreground">
                                      {' '}&mdash; {recipe.quantity_required} {item.unit}
                                    </span>
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Unlink ${itemName(recipe)}`}
                                    onClick={() => deleteRecipe(recipe.id)}
                                  >
                                    <Trash2 />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && !modalType && !restockItem && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {modalType === 'raw' && (
        <ModalShell title="Add Raw Material" onClose={closeModal}>
          <form onSubmit={handleRawSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ingredient Name
              <input
                type="text"
                value={rawForm.name}
                onChange={(e) => setRawForm({ ...rawForm, name: e.target.value })}
                placeholder="e.g. Octopus"
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Unit
              <input
                type="text"
                value={rawForm.unit}
                onChange={(e) => setRawForm({ ...rawForm, unit: e.target.value })}
                placeholder="e.g. grams, pcs, boxes"
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Current Stock
              <input
                type="number"
                min="0"
                step="1"
                value={rawForm.current_stock}
                onChange={(e) => setRawForm({ ...rawForm, current_stock: e.target.value })}
                placeholder="e.g. 5000"
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Minimum Stock
              <input
                type="number"
                min="0"
                step="1"
                value={rawForm.min_stock}
                onChange={(e) => setRawForm({ ...rawForm, min_stock: e.target.value })}
                placeholder="e.g. 500"
                required
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Add Raw Material'}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {modalType === 'link' && (
        <ModalShell title="Link Recipe" onClose={closeModal}>
          <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Item Type
              <select
                value={linkForm.item_type}
                onChange={(e) => setLinkForm({ ...linkForm, item_type: e.target.value as 'product' | 'add_on', product_id: '', add_on_id: '' })}
                required
                className={inputClass}
              >
                <option value="product">Product</option>
                <option value="add_on">Add-on</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Product / Add-on
              <select
                value={linkForm.item_type === 'product' ? linkForm.product_id : linkForm.add_on_id}
                onChange={(e) => setLinkForm({
                  ...linkForm,
                  [linkForm.item_type === 'product' ? 'product_id' : 'add_on_id']: e.target.value
                })}
                required
                className={inputClass}
              >
                <option value="">Select a product or add-on…</option>
                <optgroup label="Main Products">
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Add-ons">
                  {addOns.map((addOn) => (
                    <option key={addOn.id} value={addOn.id}>
                      {addOn.name} (+{formatPeso(addOn.price)})
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ingredient / Raw Material
              <select
                value={linkForm.inventory_item_id}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, inventory_item_id: e.target.value })
                }
                required
                className={inputClass}
              >
                <option value="">Select an ingredient…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Quantity Required
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={linkForm.quantity_required}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, quantity_required: e.target.value })
                }
                placeholder={
                  linkForm.inventory_item_id
                    ? `e.g. 100 ${ingredientById(linkForm.inventory_item_id)?.unit ?? ''}`
                    : 'e.g. 4'
                }
                required
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Existing Links
              </p>
              {recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipe links yet.</p>
              ) : (
                <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                  {recipes.map((recipe) => {
                    const ingredient = ingredientById(recipe.inventory_item_id)
                    return (
                      <li
                        key={recipe.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{itemName(recipe)}</span>
                          <span className="text-muted-foreground">
                            {' '}&mdash; {recipe.quantity_required} {ingredient?.unit ?? 'units'} of{' '}
                            {ingredient?.name ?? 'Unknown'}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Unlink ${itemName(recipe)}`}
                          onClick={() => deleteRecipe(recipe.id)}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Link'}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {restockItem && (
        <ModalShell title={`Restock ${restockItem.name}`} onClose={closeRestock}>
          <p className="mb-4 text-sm text-muted-foreground">
            Current stock:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {restockItem.current_stock} {restockItem.unit}
            </span>
          </p>

          <div className="mb-4 flex gap-2">
            {RESTOCK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() => applyRestock(amount)}
              >
                +{amount}
              </Button>
            ))}
          </div>

          <form onSubmit={handleRestockSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Custom Amount
              <input
                type="number"
                min="1"
                step="1"
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                placeholder="e.g. 25"
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeRestock}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !restockAmount}>
                {submitting ? 'Restocking…' : 'Apply'}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="inventory-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
