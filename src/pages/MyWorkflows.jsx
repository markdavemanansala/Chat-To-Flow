import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { getWorkflowDrafts, deleteWorkflowDraft } from '@/lib/api'
import { templates } from '@/data/templates'
import { useToast } from '@/components/ToastProvider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function MyWorkflows() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [drafts, setDrafts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    const savedDrafts = await getWorkflowDrafts()
    setDrafts(savedDrafts)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        await deleteWorkflowDraft(id)
        await loadDrafts()
        showToast('Workflow deleted', 'success')
      } catch (error) {
        showToast('Failed to delete workflow', 'error')
      }
    }
  }

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredDrafts = drafts.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="mb-8 pt-6">
        <h1 className="text-4xl font-bold mb-2">My Workflows</h1>
        <p className="text-muted-foreground">
          Manage your templates, drafts, and live automations
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({templates.length + drafts.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="live">Live Agents (0)</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {/* Templates */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Built-in Templates</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline">{template.industry}</Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => navigate('/templates')}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Saved Drafts */}
          {filteredDrafts.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">My Drafts</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {filteredDrafts.map((draft) => (
                  <Card key={draft.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{draft.name}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant={draft.source === 'template' ? 'default' : 'secondary'}>
                            {draft.source}
                          </Badge>
                          {draft.savedAt && (
                            <Badge variant="outline">
                              {new Date(draft.savedAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-sm">
                        {draft.notes || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {draft.integrations && draft.integrations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {draft.integrations.map((integration, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {integration}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // Load draft into store and navigate to builder
                            navigate('/preview')
                          }}
                        >
                          Open
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDelete(draft.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredTemplates.length === 0 && filteredDrafts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No workflows found matching your search.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="outline">{template.industry}</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => navigate('/templates')}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="drafts">
          {filteredDrafts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-bold mb-2">No Drafts Yet</h2>
              <p className="text-muted-foreground mb-6">
                Start building your first workflow to see it here.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link to="/templates">
                  <Button>Browse Templates</Button>
                </Link>
                <Link to="/chat">
                  <Button variant="outline">Start with Chat</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredDrafts.map((draft) => (
                <Card key={draft.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{draft.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={draft.source === 'template' ? 'default' : 'secondary'}>
                          {draft.source}
                        </Badge>
                        {draft.savedAt && (
                          <Badge variant="outline">
                            {new Date(draft.savedAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-sm">
                      {draft.notes || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {draft.integrations && draft.integrations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {draft.integrations.map((integration, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {integration}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate('/preview')}
                      >
                        Open
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDelete(draft.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="live">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-2xl font-bold mb-2">No Live Agents</h2>
            <p className="text-muted-foreground mb-2">You don't have any live agents running.</p>
            <p className="text-sm text-muted-foreground mb-6">
              Live agents are workflows that are currently running and monitoring triggers.
            </p>
            <Link to="/">
              <Button>Create Your First Agent</Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

