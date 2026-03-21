import { useCallback } from 'react'
import { FileToast } from './FileToast.tsx'
import styles from './ToastContainer.module.css'

interface ToastContainerProps {
  filePaths: string[]
  onDismiss: (path: string) => void
}

export function ToastContainer({ filePaths, onDismiss }: ToastContainerProps) {
  const handleDismiss = useCallback(
    (path: string) => () => {
      onDismiss(path)
    },
    [onDismiss],
  )

  if (filePaths.length === 0) return null

  return (
    <div className={styles.container}>
      {filePaths.map((path) => (
        <FileToast key={path} path={path} onDismiss={handleDismiss(path)} />
      ))}
    </div>
  )
}
