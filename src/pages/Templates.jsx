import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { templates } from "@/data/templates"
import { useSetTemplate, useSetWorkflow, useSetFlow } from "@/store/app"
import { GuidedTemplateChecklist } from "@/components/templates/GuidedTemplateChecklist"
import { generateWorkflowFromIntent } from "@/lib/api"
import { convertWorkflowToFlow } from "@/components/WorkflowBuilder"

const industries = ["All", "F&B", "Retail", "Real Estate", "Education", "Healthcare", "VA/Freelance", "Generic"]

export function Templates() {
  const navigate = useNavigate()
  const setTemplate = useSetTemplate()
  const setWorkflow = useSetWorkflow()
  const setFlow = useSetFlow()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState("All")

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.sampleIntent.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesIndustry = selectedIndustry === "All" || template.industry === selectedIndustry

    return matchesSearch && matchesIndustry
  })

  const [selectedTemplateForChecklist, setSelectedTemplateForChecklist] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleUseTemplate = async (template) => {
    // Set selected template in Zustand
    setTemplate(template)
    
    // Show guided checklist for templates with variables
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplateForChecklist(template)
    } else {
      await createAndNavigate(template)
    }
  }

  const createAndNavigate = async (template, checklistData = {}) => {
    setIsGenerating(true)
    try {
      // Generate workflow from template's sample intent
      const workflowSummary = await generateWorkflowFromIntent(template.sampleIntent)
      
      // Enhance with template metadata
      const enhancedWorkflow = {
        ...workflowSummary,
        name: template.name,
        integrations: [...new Set([...workflowSummary.integrations, template.industry])],
        notes: `Generated from ${template.name} template. ${template.description} Trigger: ${template.sampleIntent}`,
        source: "template",
        ...checklistData
      }

      setWorkflow(enhancedWorkflow)
      
      // Convert workflow to nodes/edges and set in store (same as chat)
      const { nodes, edges } = convertWorkflowToFlow(enhancedWorkflow)
      if (nodes.length > 0) {
        setFlow(nodes, edges)
        console.log('✅ Template workflow converted to nodes/edges:', nodes.length, 'nodes')
      }

      // Navigate to preview
      navigate("/preview")
      setSelectedTemplateForChecklist(null)
    } catch (error) {
      console.error("Error generating workflow from template:", error)
      // Fallback to basic workflow structure
      const workflowSummary = {
        name: template.name,
        trigger: `Manual trigger or scheduled: ${template.sampleIntent}`,
        steps: template.description.split('. ').filter(Boolean).slice(0, 4),
        integrations: [template.industry],
        notes: `Generated from ${template.name} template. ${template.description}`,
        source: "template",
        ...checklistData
      }
      setWorkflow(workflowSummary)
      
      // Convert workflow to nodes/edges and set in store (same as chat)
      const { nodes, edges } = convertWorkflowToFlow(workflowSummary)
      if (nodes.length > 0) {
        setFlow(nodes, edges)
        console.log('✅ Fallback template workflow converted to nodes/edges:', nodes.length, 'nodes')
      }
      
      navigate("/preview")
      setSelectedTemplateForChecklist(null)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Templates</h1>
        <p className="text-muted-foreground">
          Choose a template to get started or modify to your needs
        </p>
      </div>

      {/* Search Box */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Industry Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {industries.map((industry) => (
          <button
            key={industry}
            onClick={() => setSelectedIndustry(industry)}
            className={selectedIndustry === industry ? "" : ""}
          >
            <Badge
              variant={selectedIndustry === industry ? "default" : "outline"}
              className="cursor-pointer hover:bg-secondary"
            >
              {industry}
            </Badge>
          </button>
        ))}
      </div>

      {/* Guided Checklist */}
      {selectedTemplateForChecklist && (
        <div className="mb-6">
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Setup: {selectedTemplateForChecklist.name}</CardTitle>
              <CardDescription>Complete these steps to configure your template</CardDescription>
            </CardHeader>
            <CardContent>
              <GuidedTemplateChecklist 
                template={selectedTemplateForChecklist}
                onComplete={(data) => createAndNavigate(selectedTemplateForChecklist, data)}
              />
              <Button 
                variant="outline" 
                onClick={() => setSelectedTemplateForChecklist(null)}
                className="mt-4"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!selectedTemplateForChecklist && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-2xl font-bold mb-2">No templates found</h2>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search or filter criteria.
          </p>
          <Button onClick={() => {
            setSearchQuery("")
            setSelectedIndustry("All")
          }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Templates Grid */}
      {!selectedTemplateForChecklist && filteredTemplates.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {template.industry}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground mb-4 italic">
                  "{template.sampleIntent}"
                </p>
                <Button 
                  className="w-full mt-auto" 
                  onClick={() => handleUseTemplate(template)}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Use Template"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Empty State for No Templates */}
      {!selectedTemplateForChecklist && templates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-2">Get Started with Templates</h2>
          <p className="text-muted-foreground mb-6">
            Templates make it easy to create workflows quickly. Choose one to begin!
          </p>
          <Button onClick={() => navigate("/chat")}>
            Or Build from Scratch
          </Button>
        </div>
      )}
    </div>
  )
}
