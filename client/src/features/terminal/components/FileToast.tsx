import { useCallback, useEffect, useRef, useState } from 'react'
import { openFile } from '@/api/files.ts'
import styles from './FileToast.module.css'

interface FileToastProps {
  path: string
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 8000

export function FileToast({ path, onDismiss }: FileToastProps) {
  const [dismissing, setDismissing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const basename = path.split('/').pop() ?? path

  const dismiss = useCallback(() => {
    if (dismissing) return
    setDismissing(true)
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [dismissing])

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [dismiss])

  const handleAnimationEnd = useCallback(() => {
    if (dismissing) {
      onDismiss()
    }
  }, [dismissing, onDismiss])

  const handleOpen = useCallback(() => {
    void openFile(path, 'file')
    dismiss()
  }, [path, dismiss])

  const handleFinder = useCallback(() => {
    void openFile(path, 'folder')
    dismiss()
  }, [path, dismiss])

  const className = [styles.toast, dismissing ? styles.dismissing : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onAnimationEnd={handleAnimationEnd}>
      <div className={styles.icon}>&bull;</div>
      <span className={styles.name} title={path}>
        {basename}
      </span>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={handleOpen}>
          Open
        </button>
        <button className={styles.btn} onClick={handleFinder}>
          Finder
        </button>
      </div>
    </div>
  )
}
