import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorkflowBuilder } from '@/components/WorkflowBuilder'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ToastProvider'

export function WorkflowBuilderPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [isBuilderOpen, setIsBuilderOpen] = useState(true)

  const handleClose = () => {
    showToast('Workflow saved!', 'success')
    navigate('/preview')
  }

  const handleBack = () => {
    navigate('/preview')
  }

  if (!isBuilderOpen) {
    return null
  }

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <Button variant="outline" onClick={handleBack}>
          ← Back to Preview
        </Button>
      </div>
      <WorkflowBuilder onClose={handleClose} />
    </div>
  )
}

