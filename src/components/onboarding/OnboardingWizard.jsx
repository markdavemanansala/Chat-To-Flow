import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { templates } from "@/data/templates"
import { useSetTemplate, useSetWorkflow } from "@/store/app"
import { Badge } from "@/components/ui/badge"

export function OnboardingWizard({ open, onOpenChange }) {
  const navigate = useNavigate()
  const setTemplate = useSetTemplate()
  const setWorkflow = useSetWorkflow()
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedIntegrations, setSelectedIntegrations] = useState([])

  const availableIntegrations = [
    { id: 'facebook', name: 'Facebook', icon: '📘', required: false },
    { id: 'telegram', name: 'Telegram', icon: '✈️', required: false },
    { id: 'email', name: 'Email/SMTP', icon: '📧', required: false },
    { id: 'sheets', name: 'Google Sheets', icon: '📊', required: false },
  ]

  const handleNext = () => {
    if (step === 4) {
      // Complete wizard
      if (selectedTemplate) {
        setTemplate(selectedTemplate)
        const workflowSummary = {
          name: selectedTemplate.name,
          trigger: `Template: ${selectedTemplate.sampleIntent}`,
          steps: selectedTemplate.description.split('. ').filter(Boolean),
          integrations: selectedIntegrations.map(i => i.name),
          notes: `Generated from ${selectedTemplate.name} template via onboarding wizard.`,
          source: "template"
        }
        setWorkflow(workflowSummary)
      }
      navigate("/preview")
      onOpenChange(false)
    } else {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const toggleIntegration = (integration) => {
    setSelectedIntegrations(prev => 
      prev.find(i => i.id === integration.id)
        ? prev.filter(i => i.id !== integration.id)
        : [...prev, integration]
    )
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Your First Flow - Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Choose a template to get started"}
            {step === 2 && "Select the integrations you'll need"}
            {step === 3 && "Preview your workflow configuration"}
            {step === 4 && "All set! Let's create your workflow"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Choose Template */}
          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
              {templates.slice(0, 4).map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="text-xs">{template.industry}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step 2: Confirm Integrations */}
          {step === 2 && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <p className="text-sm text-muted-foreground mb-4">
                Select the services you want to connect (you can add more later):
              </p>
              {availableIntegrations.map((integration) => (
                <Card 
                  key={integration.id}
                  className={`cursor-pointer transition-all ${
                    selectedIntegrations.find(i => i.id === integration.id)
                      ? 'ring-2 ring-primary border-primary bg-primary/5'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => toggleIntegration(integration)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {integration.required ? 'Required' : 'Optional'}
                        </div>
                      </div>
                    </div>
                    {selectedIntegrations.find(i => i.id === integration.id) && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Workflow Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Template:</div>
                    <div className="text-sm text-muted-foreground">{selectedTemplate?.name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Integrations:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedIntegrations.length > 0 ? (
                        selectedIntegrations.map(int => (
                          <Badge key={int.id} variant="outline">{int.name}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">None selected</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-6xl">✨</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your workflow has been created. You can now customize it in the builder.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={handleBack} disabled={step === 1}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
              <Button 
                onClick={handleNext}
                disabled={step === 1 && !selectedTemplate}
              >
                {step === 4 ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

