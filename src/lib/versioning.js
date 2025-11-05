const VERSIONS_STORAGE_KEY = 'workflow_versions'

export function saveWorkflowVersion(workflow) {
  const versions = getWorkflowVersions()
  const newVersion = {
    id: Date.now().toString(),
    workflow: { ...workflow },
    createdAt: new Date().toISOString(),
    name: workflow.name || 'Untitled Workflow'
  }
  
  const updated = [newVersion, ...versions].slice(0, 20) // Keep last 20 versions
  localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(updated))
  
  return newVersion
}

export function getWorkflowVersions() {
  try {
    const saved = localStorage.getItem(VERSIONS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (e) {
    console.error('Failed to load versions', e)
    return []
  }
}

export function restoreWorkflowVersion(versionId) {
  const versions = getWorkflowVersions()
  const version = versions.find(v => v.id === versionId)
  return version ? version.workflow : null
}

export function deleteWorkflowVersion(versionId) {
  const versions = getWorkflowVersions()
  const updated = versions.filter(v => v.id !== versionId)
  localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(updated))
}

