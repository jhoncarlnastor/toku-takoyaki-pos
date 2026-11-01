import { PageHeader } from '@/components/admin/page-header'
import { ThemeSelector } from '@/components/admin/theme-selector'

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Customize the appearance of your admin console." />
      <section aria-labelledby="theme-heading" className="flex flex-col gap-3">
        <h2 id="theme-heading" className="text-sm font-semibold">
          Theme
        </h2>
        <ThemeSelector />
      </section>
    </>
  )
}
