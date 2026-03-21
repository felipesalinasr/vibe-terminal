import { useState, useRef, useCallback, useEffect } from 'react'
import { useAutocomplete } from '@/hooks/useAutocomplete.ts'
import css from './PathAutocomplete.module.css'

interface PathAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSubmit?: () => void
  className?: string
}

export function PathAutocomplete({
  value,
  onChange,
  placeholder = '~/Projects/my-app',
  onSubmit,
  className,
}: PathAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: suggestions = [] } = useAutocomplete(value, showDropdown)

  /* Reset selection when suggestions change */
  useEffect(() => {
    setSelectedIdx(-1)
  }, [suggestions])

  const accept = useCallback(
    (item: string) => {
      onChange(item)
      setShowDropdown(false)
      setSelectedIdx(-1)
      inputRef.current?.focus()
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || suggestions.length === 0) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSubmit?.()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          /* Let parent handle escape */
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIdx((prev) => Math.max(prev - 1, 0))
          break
        case 'Tab':
          e.preventDefault()
          if (suggestions.length === 1) {
            accept(suggestions[0])
          } else if (selectedIdx >= 0) {
            accept(suggestions[selectedIdx])
          }
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIdx >= 0) {
            accept(suggestions[selectedIdx])
          } else {
            setShowDropdown(false)
            onSubmit?.()
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowDropdown(false)
          setSelectedIdx(-1)
          break
      }
    },
    [showDropdown, suggestions, selectedIdx, accept, onSubmit],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
      setShowDropdown(true)
    },
    [onChange],
  )

  const handleFocus = useCallback(() => {
    if (value.length > 0) setShowDropdown(true)
  }, [value])

  const handleBlur = useCallback(() => {
    /* Delay to allow click on item */
    setTimeout(() => setShowDropdown(false), 150)
  }, [])

  const listVisible = showDropdown && suggestions.length > 0

  return (
    <div className={`${css.wrapper} ${className ?? ''}`}>
      <div className={`${css.list} ${listVisible ? css.listVisible : ''}`}>
        {suggestions.map((item, i) => (
          <div
            key={item}
            className={`${css.item} ${i === selectedIdx ? css.itemSelected : ''}`}
            onMouseDown={() => accept(item)}
          >
            {item}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        className={css.input}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  )
}
