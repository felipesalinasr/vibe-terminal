import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../board.ts'

describe('useBoardStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useBoardStore.setState({
      backlogTasks: [],
      nextBacklogId: 1,
    })
  })

  describe('addTask', () => {
    it('adds a task to the backlog', () => {
      const task = useBoardStore.getState().addTask({ name: 'Test task' })

      const state = useBoardStore.getState()
      expect(state.backlogTasks).toHaveLength(1)
      expect(state.backlogTasks[0]).toEqual(task)
      expect(task.name).toBe('Test task')
      expect(task.id).toBe(1)
    })

    it('assigns the correct id from nextBacklogId', () => {
      useBoardStore.setState({ nextBacklogId: 42 })

      const task = useBoardStore.getState().addTask({ name: 'Task 42' })
      expect(task.id).toBe(42)
    })

    it('increments nextBacklogId after adding', () => {
      expect(useBoardStore.getState().nextBacklogId).toBe(1)

      useBoardStore.getState().addTask({ name: 'First' })
      expect(useBoardStore.getState().nextBacklogId).toBe(2)

      useBoardStore.getState().addTask({ name: 'Second' })
      expect(useBoardStore.getState().nextBacklogId).toBe(3)
    })

    it('preserves optional fields (tag, templateId)', () => {
      const task = useBoardStore.getState().addTask({
        name: 'Tagged task',
        tag: 'bug',
        templateId: 'tmpl-1',
      })

      expect(task.tag).toBe('bug')
      expect(task.templateId).toBe('tmpl-1')
    })

    it('appends multiple tasks without overwriting', () => {
      const store = useBoardStore.getState()
      store.addTask({ name: 'Alpha' })
      useBoardStore.getState().addTask({ name: 'Beta' })
      useBoardStore.getState().addTask({ name: 'Gamma' })

      const tasks = useBoardStore.getState().backlogTasks
      expect(tasks).toHaveLength(3)
      expect(tasks.map((t) => t.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('returns the newly created task object', () => {
      const task = useBoardStore.getState().addTask({ name: 'Return check' })

      expect(task).toEqual({
        id: 1,
        name: 'Return check',
      })
    })
  })

  describe('removeTask', () => {
    it('removes a task by id', () => {
      const store = useBoardStore.getState()
      store.addTask({ name: 'Keep' })
      useBoardStore.getState().addTask({ name: 'Remove' })
      useBoardStore.getState().addTask({ name: 'Keep too' })

      useBoardStore.getState().removeTask(2)

      const tasks = useBoardStore.getState().backlogTasks
      expect(tasks).toHaveLength(2)
      expect(tasks.map((t) => t.name)).toEqual(['Keep', 'Keep too'])
    })

    it('does nothing when id does not exist', () => {
      useBoardStore.getState().addTask({ name: 'Only task' })

      useBoardStore.getState().removeTask(999)

      expect(useBoardStore.getState().backlogTasks).toHaveLength(1)
    })

    it('does not change nextBacklogId when removing', () => {
      useBoardStore.getState().addTask({ name: 'Task' })
      const idBefore = useBoardStore.getState().nextBacklogId

      useBoardStore.getState().removeTask(1)

      expect(useBoardStore.getState().nextBacklogId).toBe(idBefore)
    })
  })

  describe('renameTask', () => {
    it('updates the name of a task by id', () => {
      useBoardStore.getState().addTask({ name: 'Old name' })

      useBoardStore.getState().renameTask(1, 'New name')

      const task = useBoardStore.getState().backlogTasks[0]
      expect(task.name).toBe('New name')
    })

    it('does not affect other tasks', () => {
      useBoardStore.getState().addTask({ name: 'First' })
      useBoardStore.getState().addTask({ name: 'Second' })

      useBoardStore.getState().renameTask(1, 'Updated first')

      const tasks = useBoardStore.getState().backlogTasks
      expect(tasks[0].name).toBe('Updated first')
      expect(tasks[1].name).toBe('Second')
    })

    it('does nothing if id does not exist', () => {
      useBoardStore.getState().addTask({ name: 'Stable' })

      useBoardStore.getState().renameTask(999, 'Ghost')

      expect(useBoardStore.getState().backlogTasks[0].name).toBe('Stable')
    })

    it('preserves other fields when renaming', () => {
      useBoardStore.getState().addTask({ name: 'Task', tag: 'feature', templateId: 'tmpl-1' })

      useBoardStore.getState().renameTask(1, 'Renamed')

      const task = useBoardStore.getState().backlogTasks[0]
      expect(task.name).toBe('Renamed')
      expect(task.tag).toBe('feature')
      expect(task.templateId).toBe('tmpl-1')
    })
  })

  describe('nextBacklogId', () => {
    it('starts at 1', () => {
      expect(useBoardStore.getState().nextBacklogId).toBe(1)
    })

    it('increments monotonically through add/remove cycles', () => {
      useBoardStore.getState().addTask({ name: 'A' }) // id=1, next=2
      useBoardStore.getState().addTask({ name: 'B' }) // id=2, next=3
      useBoardStore.getState().removeTask(1)           // next still 3
      useBoardStore.getState().addTask({ name: 'C' }) // id=3, next=4

      expect(useBoardStore.getState().nextBacklogId).toBe(4)
      expect(useBoardStore.getState().backlogTasks.map((t) => t.id)).toEqual([2, 3])
    })
  })
})
