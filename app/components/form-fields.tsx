'use client'

export function TextInput({
  label,
  labelHint,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  inputMode,
  step,
  min,
  max,
  readOnly,
}: {
  label: string
  labelHint?: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  hint?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email'
  step?: string
  min?: string
  max?: string
  readOnly?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">
        {label}
        {labelHint && <span className="ml-1 font-normal italic text-foreground/50">{labelHint}</span>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        step={step}
        min={min}
        max={max}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full read-only:bg-foreground/5 read-only:cursor-default"
      />
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </label>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = '—',
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
  multi = false,
  gridClassName,
  hint,
}: {
  label: string
  options: readonly string[]
  value: string | string[]
  onChange: (next: string | string[]) => void
  multi?: boolean
  gridClassName?: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className={gridClassName ?? 'flex flex-wrap gap-1.5'}>
        {options.map((option) => {
          const selected = multi
            ? (value as string[]).includes(option)
            : value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (multi) {
                  const current = value as string[]
                  onChange(
                    current.includes(option)
                      ? current.filter((item) => item !== option)
                      : [...current, option],
                  )
                } else {
                  onChange(value === option ? '' : option)
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer flex-1 whitespace-nowrap ${
                selected
                  ? 'bg-accent text-white border-accent'
                  : 'border-foreground/15 bg-white text-foreground hover:border-foreground/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </div>
  )
}
