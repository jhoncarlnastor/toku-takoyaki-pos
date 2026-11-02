'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageOff, PackagePlus, Pencil, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { EmptySection } from '@/components/admin/empty-section'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPeso } from '@/lib/currency'
import { supabase } from '@/lib/supabase'

type Product = {
  id: string
  name: string
  category: string
  price: number
  image_url: string | null
}

type AddOn = {
  id: string
  name: string
  price: number
  applicable_categories?: string[]
}

type ModalType = 'products' | 'add_ons'

type ProductForm = {
  name: string
  category: 'Takoyaki' | 'Drinks'
  price: string
  
}

type AddOnForm = {
  name: string
  price: string
  applicable_categories: string[]
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  category: 'Takoyaki',
  price: '',
}

const EMPTY_ADDON_FORM: AddOnForm = {
  name: '',
  price: '',
  applicable_categories: ['Takoyaki', 'Drinks'],
}

const inputClass =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'add-ons'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingAddOns, setLoadingAddOns] = useState(true)

  const [modalType, setModalType] = useState<ModalType | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM)
  const [addOnForm, setAddOnForm] = useState<AddOnForm>(EMPTY_ADDON_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    const { data, error } = await supabase.from('products').select('*')

    if (error) {
      console.error('Error fetching menu:', error)
      setProducts([])
    } else {
      setProducts((data as Product[]) ?? [])
    }
    setLoadingProducts(false)
  }, [])

  const fetchAddOns = useCallback(async () => {
    setLoadingAddOns(true)
    const { data, error } = await supabase.from('add_ons').select('*')

    if (error) {
      console.error('Error fetching add-ons:', error)
      setAddOns([])
    } else {
      setAddOns((data as AddOn[]) ?? [])
    }
    setLoadingAddOns(false)
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchAddOns()

    const channel = supabase
      .channel('add_ons_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'add_ons' },
        () => {
          fetchAddOns()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProducts, fetchAddOns])

  function clearImageSelection() {
    setImageFile(null)
    setImagePreview(null)
  }

  function openAddModal(type: ModalType) {
    setModalType(type)
    setEditingProduct(null)
    setEditingAddOn(null)
    setProductForm(EMPTY_PRODUCT_FORM)
    setAddOnForm(EMPTY_ADDON_FORM)
    clearImageSelection()
    setError(null)
  }

  function openEditProduct(product: Product) {
    setModalType('products')
    setEditingProduct(product)
    setEditingAddOn(null)
    setProductForm({
      name: product.name,
      category: product.category === 'Drinks' ? 'Drinks' : 'Takoyaki',
      price: String(product.price),
    })
    setImageFile(null)
    setImagePreview(product.image_url ?? null)
    setError(null)
  }

  function openEditAddOn(addOn: AddOn) {
    setModalType('add_ons')
    setEditingAddOn(addOn)
    setEditingProduct(null)
    setAddOnForm({
      name: addOn.name,
      price: String(addOn.price),
      applicable_categories: addOn.applicable_categories ?? [],
    })
    clearImageSelection()
    setError(null)
  }

  function closeModal() {
    setModalType(null)
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview)
    clearImageSelection()
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError(null)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : editingProduct?.image_url ?? null)
  }

  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      name: productForm.name.trim(),
      category: productForm.category,
      price: Number(productForm.price),
      image_url: editingProduct?.image_url ?? null,
    }

    if (!payload.name || Number.isNaN(payload.price)) {
      setError('Please fill in all fields with valid values.')
      setSubmitting(false)
      return
    }

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, imageFile, { upsert: true })

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        const friendlyMessage =
          uploadError.message.toLowerCase().includes('bucket not found')
            ? "Please create a public 'products' bucket in Supabase Storage."
            : `Image upload failed: ${uploadError.message}. Saving product without a new image.`
        setError(friendlyMessage)
        alert(friendlyMessage)
      } else {
        payload.image_url = supabase.storage.from('products').getPublicUrl(fileName).data.publicUrl
      }
    }

    let result
    if (editingProduct) {
      result = await supabase.from('products').update(payload).eq('id', editingProduct.id)
    } else {
      result = await supabase.from('products').insert([payload])
    }

    if (result.error) {
      console.error('Error saving product:', result.error)
      setError(result.error.message)
    } else {
      closeModal()
      fetchProducts()
    }
    setSubmitting(false)
  }

  async function handleAddOnSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      name: addOnForm.name.trim(),
      price: Number(addOnForm.price),
      applicable_categories: addOnForm.applicable_categories,
    }

    if (!payload.name || Number.isNaN(payload.price)) {
      setError('Please fill in all fields with valid values.')
      setSubmitting(false)
      return
    }

    let saveError: { message: string } | null = null

    if (editingAddOn) {
      const res = await supabase.from('add_ons').update(payload).eq('id', editingAddOn.id)
      saveError = res.error
      if (!saveError) {
        setAddOns((prev) =>
          prev.map((a) => (a.id === editingAddOn.id ? { ...a, ...payload } : a))
        )
      }
    } else {
      const res = await supabase.from('add_ons').insert([payload]).select()
      saveError = res.error
      if (!saveError && res.data) {
        setAddOns((prev) => [...prev, ...(res.data as AddOn[])])
      }
    }

    if (saveError) {
      console.error('Error saving add-on:', saveError)
      setError(saveError.message)
    } else {
      closeModal()
      fetchAddOns()
    }
    setSubmitting(false)
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return

    // 1. Delete related product_recipes first to avoid foreign key conflict
    const { error: recipeError } = await supabase
      .from('product_recipes')
      .delete()
      .eq('product_id', product.id)

    if (recipeError) {
      console.error('Error deleting related product recipes:', recipeError)
      setError(recipeError.message)
      return
    }

    // 2. Clear product_id references in order_items if foreign key exists, or perform soft delete / hard delete
    const { error: orderItemsError } = await supabase
      .from('order_items')
      .update({ product_id: null })
      .eq('product_id', product.id)

    if (orderItemsError) {
      console.warn('Note on order_items update (may be optional):', orderItemsError.message)
    }

    // 3. Delete the product itself
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      console.error('Error deleting product:', error)
      setError(error.message)
    } else {
      // 4. Immediately update local state without hard refresh
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      fetchProducts()
    }
  }

  async function handleDeleteAddOn(addOn: AddOn) {
    if (!window.confirm(`Delete "${addOn.name}"?`)) return

    const { error } = await supabase.from('add_ons').delete().eq('id', addOn.id)
    if (error) {
      console.error('Error deleting add-on:', error)
      setError(error.message)
    } else {
      setAddOns((prev) => prev.filter((a) => a.id !== addOn.id))
      fetchAddOns()
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-pretty text-sm text-muted-foreground">Manage menu items and pricing.</p>
        </div>
        <Button
          onClick={() => openAddModal(activeTab === 'products' ? 'products' : 'add_ons')}
        >
          <Plus data-icon="inline-start" />
          {activeTab === 'products' ? 'Add Product' : 'Add Add-on'}
        </Button>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'products' | 'add-ons')}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="add-ons">Add-ons</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {loadingProducts ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16">
              <p className="text-sm text-muted-foreground">Loading products…</p>
            </div>
          ) : products.length === 0 ? (
            <EmptySection icon={UtensilsCrossed} message="No products yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="size-10 shrink-0 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
                              <ImageOff className="size-4" aria-hidden="true" />
                            </span>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatPeso(product.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${product.name}`}
                            onClick={() => openEditProduct(product)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add-ons">
          {loadingAddOns ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16">
              <p className="text-sm text-muted-foreground">Loading add-ons…</p>
            </div>
          ) : addOns.length === 0 ? (
            <EmptySection icon={PackagePlus} message="No add-ons yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Applicable Categories</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {addOns.map((addOn) => (
                    <tr key={addOn.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{addOn.name}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPeso(addOn.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(addOn.applicable_categories ?? []).map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${addOn.name}`}
                            onClick={() => openEditAddOn(addOn)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`Delete ${addOn.name}`}
                            onClick={() => handleDeleteAddOn(addOn)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="menu-modal-title" className="text-lg font-semibold">
                {modalType === 'products'
                  ? editingProduct
                    ? 'Edit Product'
                    : 'Add Product'
                  : editingAddOn
                    ? 'Edit Add-on'
                    : 'Add Add-on'}
              </h2>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={closeModal}>
                <X />
              </Button>
            </div>

            {modalType === 'products' ? (
              <form onSubmit={handleProductSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Product Name
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Classic Takoyaki"
                    required
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Category
                  <select
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        category: e.target.value as ProductForm['category'],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="Takoyaki">Takoyaki</option>
                    <option value="Drinks">Drinks</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </label>

                <div className="flex flex-col gap-1.5 text-sm font-medium">
                  <span>Image</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="flex h-9 w-full cursor-pointer items-center rounded-lg border border-input bg-background px-3 text-sm font-normal file:mr-3 file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:text-xs file:font-medium file:text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>

                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-28 w-full rounded-lg border border-border object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddOnSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Add-on Name
                  <input
                    type="text"
                    value={addOnForm.name}
                    onChange={(e) => setAddOnForm({ ...addOnForm, name: e.target.value })}
                    placeholder="e.g. Extra Sauce"
                    required
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addOnForm.price}
                    onChange={(e) => setAddOnForm({ ...addOnForm, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </label>

                <div className="flex flex-col gap-2 text-sm font-medium">
                  <span>Applicable Categories</span>
                  <div className="flex gap-4">
                    {['Takoyaki', 'Drinks'].map((cat) => {
                      const checked = addOnForm.applicable_categories.includes(cat)
                      return (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...addOnForm.applicable_categories, cat]
                                : addOnForm.applicable_categories.filter((c) => c !== cat)
                              setAddOnForm({ ...addOnForm, applicable_categories: next })
                            }}
                            className="size-4 rounded border-input accent-primary"
                          />
                          <span className="font-normal">{cat}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editingAddOn ? 'Save Changes' : 'Add Add-on'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
