import { Routes, Route, Navigate } from 'react-router-dom'
import { Providers } from './app/Providers.tsx'
import { Header, KanbanBoard, SidePanel, CreateTaskModal, StartSessionModal, ProjectStrip, ProjectContextEditor } from './features/board/index.ts'
import { AgentsView, TemplateModal } from './features/templates/index.ts'
import { ToolsView } from './features/tools/index.ts'
import { useUiStore } from './stores/ui.ts'

function BoardView() {
  return <KanbanBoard />
}

function AppShell() {
  const activeModal = useUiStore((s) => s.activeModal)

  return (
    <>
      <Header />
      <ProjectStrip />
      <Routes>
        <Route path="/" element={<BoardView />} />
        <Route path="/agents" element={<AgentsView />} />
        <Route path="/tools" element={<ToolsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SidePanel />
      {activeModal === 'createTask' && <CreateTaskModal />}
      {activeModal === 'startSession' && <StartSessionModal />}
      {activeModal === 'template' && <TemplateModal />}
      <ProjectContextEditor />
    </>
  )
}

export function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  )
}
