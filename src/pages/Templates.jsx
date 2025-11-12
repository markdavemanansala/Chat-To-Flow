import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { templates } from "@/data/templates"
import { useSetFlow, useApplyPatch } from "@/store/graphStore"
import { useSetSummary } from "@/store/aiStore"
import { GuidedTemplateChecklist } from "@/components/templates/GuidedTemplateChecklist"
import { planFromIntent } from "@/workflow/planner"

const industries = ["All", "F&B", "Retail", "Real Estate", "Education", "Healthcare", "VA/Freelance", "Generic"]

export function Templates() {
  const navigate = useNavigate()
  const setFlow = useSetFlow()
  const applyPatch = useApplyPatch()
  const setSummary = useSetSummary()

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
      // Build intent from template, incorporating checklist data if provided
      let intent = template.sampleIntent
      if (Object.keys(checklistData).length > 0) {
        // Replace variables in intent with checklist data
        Object.entries(checklistData).forEach(([key, value]) => {
          intent = intent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        })
      }
      
      console.log('🚀 Generating workflow from template:', template.name)
      console.log('📝 Intent:', intent)
      
      // Use the patch-based system (same as Chat)
      // Pass the intent as both intent and originalIntent for better context
      const patch = await planFromIntent(intent, 'Empty workflow (no nodes)', [], intent)
      
      if (!patch) {
        throw new Error('Failed to generate workflow patch')
      }
      
      // Apply the patch
      const result = applyPatch(patch)
      
      if (!result.ok) {
        throw new Error(`Patch application failed: ${result.issues?.join(', ')}`)
      }
      
      console.log('✅ Template workflow created successfully:', result.nodes?.length || 0, 'nodes')
      
      // Update AI summary with template info
      const summary = `Template: ${template.name}\n${template.description}\nIntent: ${intent}`
      setSummary(summary)

      // Navigate to builder
      navigate("/builder")
      setSelectedTemplateForChecklist(null)
    } catch (error) {
      console.error("Error generating workflow from template:", error)
      alert(`Failed to create workflow: ${error.message}. Please try again or use the chat builder.`)
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
