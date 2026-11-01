export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-1">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-pretty text-sm text-muted-foreground">{description}</p>}
    </header>
  )
}
