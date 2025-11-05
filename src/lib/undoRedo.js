export function createHistory() {
  let history = []
  let currentIndex = -1
  const maxHistory = 50

  return {
    push(state) {
      // Remove any future history if we're not at the end
      history = history.slice(0, currentIndex + 1)
      
      // Add new state
      history.push(JSON.parse(JSON.stringify(state))) // Deep clone
      
      // Limit history size
      if (history.length > maxHistory) {
        history.shift()
      } else {
        currentIndex++
      }
    },

    undo() {
      if (currentIndex > 0) {
        currentIndex--
        return JSON.parse(JSON.stringify(history[currentIndex]))
      }
      return null
    },

    redo() {
      if (currentIndex < history.length - 1) {
        currentIndex++
        return JSON.parse(JSON.stringify(history[currentIndex]))
      }
      return null
    },

    canUndo() {
      return currentIndex > 0
    },

    canRedo() {
      return currentIndex < history.length - 1
    },

    getCurrent() {
      if (currentIndex >= 0 && currentIndex < history.length) {
        return JSON.parse(JSON.stringify(history[currentIndex]))
      }
      return null
    },

    clear() {
      history = []
      currentIndex = -1
    }
  }
}

