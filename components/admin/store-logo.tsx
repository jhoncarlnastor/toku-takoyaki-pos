import { cn } from '@/lib/utils'

type StoreLogoProps = {
  /** Path to the store's logo image (e.g. "/images/logo.png"). When omitted, a placeholder is shown. */
  src?: string
  alt?: string
  className?: string
}

export function StoreLogo({ src, alt = 'Store logo', className }: StoreLogoProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={40}
        height={40}
        className={cn('size-10 shrink-0 rounded-full border border-neutral-700 object-cover', className)}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-xs font-bold text-neutral-300',
        className,
      )}
    >
      LOGO
    </div>
  )
}
