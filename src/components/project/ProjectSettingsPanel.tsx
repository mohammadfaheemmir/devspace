import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { getErrorMessage } from '../../lib/errors'
import type { Project } from '../../types/app'
import { useToast } from '../../context/useToast'
import { updateProject } from '../../lib/projectService'

// Edit the project name and description (owners and admins only).
type ProjectSettingsPanelProps = {
    project: Project
    projectId: string
    isProjectAdmin: boolean
    onProjectChange: Dispatch<SetStateAction<Project | null>>
    onError: (message: string) => void
}

function ProjectSettingsPanel({ project, projectId, isProjectAdmin, onProjectChange, onError }: ProjectSettingsPanelProps) {
    const toast = useToast()
    const [showProjectSettings, setShowProjectSettings] = useState(false)
    const [savingProjectSettings, setSavingProjectSettings] = useState(false)
    const [projectSettingsName, setProjectSettingsName] = useState('')
    const [projectSettingsDescription, setProjectSettingsDescription] = useState('')

    // Open project settings with the current saved values.
    function handleOpenProjectSettings() {
        if (!isProjectAdmin) {
            onError('Only the project owner or an admin can edit project settings.')
            return
        }

        setProjectSettingsName(project?.name || '')
        setProjectSettingsDescription(project?.description || '')
        onError('')
        setShowProjectSettings(true)
    }

    // Save project settings. Database RLS independently enforces owner/admin access.
    async function handleSaveProjectSettings(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!isProjectAdmin) {
            onError('Only the project owner or an admin can edit project settings.')
            return
        }

        if (!projectSettingsName.trim()) {
            onError('Project name cannot be empty.')
            return
        }

        try {
            setSavingProjectSettings(true)
            onError('')

            const updatedProject = await updateProject(projectId, {
                name: projectSettingsName,
                description: projectSettingsDescription,
            })

            onProjectChange((previous) => (previous ? { ...previous, ...updatedProject } : previous))
            setShowProjectSettings(false)
            toast.success('Project settings saved.')
        } catch (err) {
            console.error('Project settings update failed:', err)
            onError(getErrorMessage(err, 'Unable to update project settings.'))
        } finally {
            setSavingProjectSettings(false)
        }
    }

    return (
        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white">Project Settings</h2>
                    <p className="mt-1 text-sm text-slate-400">Manage your project name and description.</p>
                </div>
                {isProjectAdmin && !showProjectSettings && (
                    <button
                        type="button"
                        onClick={handleOpenProjectSettings}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                        Edit Settings
                    </button>
                )}
            </div>

            {showProjectSettings && isProjectAdmin && (
                <form onSubmit={handleSaveProjectSettings} className="mt-5 space-y-4 border-t border-slate-800 pt-5">
                    <div>
                        <label htmlFor="project-settings-name" className="mb-2 block text-sm font-medium text-slate-300">Project name</label>
                        <input
                            id="project-settings-name"
                            type="text"
                            value={projectSettingsName}
                            onChange={(event) => setProjectSettingsName(event.target.value)}
                            maxLength={100}
                            required
                            placeholder="Enter project name"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="project-settings-description" className="mb-2 block text-sm font-medium text-slate-300">Description</label>
                        <textarea
                            id="project-settings-description"
                            value={projectSettingsDescription}
                            onChange={(event) => setProjectSettingsDescription(event.target.value)}
                            rows={4}
                            maxLength={1000}
                            placeholder="Describe the purpose of this project..."
                            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                        />
                        <p className="mt-1 text-xs text-slate-400">Up to 1,000 characters.</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowProjectSettings(false)}
                            disabled={savingProjectSettings}
                            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={savingProjectSettings || !projectSettingsName.trim()}
                            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {savingProjectSettings ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}

            {!isProjectAdmin && (
                <p className="mt-3 text-sm text-slate-400">Only project owners and admins can edit these settings.</p>
            )}
        </section>
    )
}

export default ProjectSettingsPanel
