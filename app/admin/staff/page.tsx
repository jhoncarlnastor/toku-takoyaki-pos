'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/page-header'
import { supabase } from '@/lib/supabase'
import { hashPassword, type StaffRole, type StaffUser } from '@/lib/auth'

type StaffForm = {
  full_name: string
  email: string
  password: string
  role: StaffRole
}

const EMPTY_FORM: StaffForm = { full_name: '', email: '', password: '', role: 'Staff' }

const inputClass =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring'

const roleBadgeClass: Record<StaffRole, string> = {
  Admin: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Staff: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
}

const SETUP_HINT =
  'Staff table not found. Run sql/setup_staff_users.sql in the Supabase SQL Editor, then refresh.'

export default function StaffPage() {
  const [members, setMembers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalType, setModalType] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      setError(error.code === 'PGRST205' ? SETUP_HINT : error.message)
      setMembers([])
    } else {
      setError(null)
      setMembers((data as StaffUser[]) ?? [])
    }
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      await fetchMembers()
      if (active) setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [fetchMembers])

  function openAddModal() {
    setForm(EMPTY_FORM)
    setError(null)
    setEditingId(null)
    setModalType('add')
  }

  function openEditModal(member: StaffUser) {
    setForm({ full_name: member.full_name, email: member.email, password: '', role: member.role })
    setError(null)
    setEditingId(member.id)
    setModalType('edit')
  }

  function closeModal() {
    setModalType(null)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fullName = form.full_name.trim()
    const email = form.email.trim().toLowerCase()

    if (!fullName || !email) {
      setError('Full name and email are required.')
      return
    }
    if (modalType === 'add' && form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (modalType === 'edit' && form.password && form.password.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (modalType === 'add') {
        const passwordHash = await hashPassword(form.password)
        let insertRes = await supabase
          .from('staff_users')
          .insert({ full_name: fullName, email, password: passwordHash, role: form.role })
          .select('id, full_name, email, role, created_at')

        if (insertRes.error && insertRes.error.message.includes('password')) {
          insertRes = await supabase
            .from('staff_users')
            .insert({ full_name: fullName, email, password_hash: passwordHash, role: form.role })
            .select('id, full_name, email, role, created_at')
        }

        const { data, error } = insertRes

        if (error) {
          setError(error.code === '23505' ? 'That email is already registered.' : error.message)
          return
        }
        if (data) setMembers((prev) => [...prev, ...(data as StaffUser[])])

        // Best-effort: also create the Supabase Auth user so
        // supabase.auth.signInWithPassword works for this account.
        // (Login falls back to the staff_users credential check if this fails.)
        const { error: signUpError } = await supabase.auth.signUp({ email, password: form.password })
        if (signUpError) {
          console.log('Supabase Auth sign-up skipped:', signUpError.message)
        }
      } else if (editingId) {
        const passwordHash = form.password ? await hashPassword(form.password) : null
        const patch: Record<string, unknown> = {
          full_name: fullName,
          email,
          role: form.role,
        }
        if (passwordHash) {
          patch.password = passwordHash
        }
        let updateRes = await supabase
          .from('staff_users')
          .update(patch)
          .eq('id', editingId)
          .select('id, full_name, email, role, created_at')

        if (updateRes.error && updateRes.error.message.includes('password')) {
          delete patch.password
          if (passwordHash) {
            patch.password_hash = passwordHash
          }
          updateRes = await supabase
            .from('staff_users')
            .update(patch)
            .eq('id', editingId)
            .select('id, full_name, email, role, created_at')
        }

        const { data, error } = updateRes

        if (error) {
          setError(error.code === '23505' ? 'That email is already registered.' : error.message)
          return
        }
        if (data) {
          setMembers((prev) => prev.map((m) => (m.id === editingId ? ((data[0] ?? data) as StaffUser) : m)))
        }
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(member: StaffUser) {
    if (!window.confirm(`Delete "${member.full_name}"?`)) return
    const { error } = await supabase.from('staff_users').delete().eq('id', member.id)
    if (error) {
      setError(error.message)
      return
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
  }

  return (
    <>
      <PageHeader title="Staff & Roles" description="Manage team members and their permissions." />

      <div className="mb-4 flex justify-end">
        <Button onClick={openAddModal}>
          <Plus data-icon="inline-start" />
          Add Member
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">Loading staff…</p>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {error ? 'Setup required' : 'No staff members yet'}
          </p>
          {error && <p className="max-w-md px-4 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{member.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass[member.role]}`}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(member)}>
                        <Pencil className="size-3.5" data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(member)}
                      >
                        <Trash2 className="size-3.5" data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="staff-modal-title" className="text-lg font-semibold">
                {modalType === 'add' ? 'Add Member' : 'Edit Member'}
              </h2>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={closeModal}>
                <X />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Full Name
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Juan Dela Cruz"
                  required
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. juan@toku.local"
                  required
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {modalType === 'add' ? 'Password' : 'New Password (leave blank to keep current)'}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={modalType === 'add' ? 'Min. 6 characters' : '••••••••'}
                  autoComplete="new-password"
                  required={modalType === 'add'}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                  className={inputClass}
                >
                  <option value="Admin">Admin — full access (/admin, /pos, /customer-view)</option>
                  <option value="Staff">Staff — POS and customer display only</option>
                </select>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : modalType === 'add' ? 'Create Account' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
