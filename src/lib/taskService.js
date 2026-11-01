
import { supabase } from './supabase'

// Get authenticated user
async function getCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(`Authentication error: ${error.message}`)
    }

    if (!user) {
        throw new Error('Please log in to continue.')
    }

    return user
}

// Fetch project tasks
export async function getTasks(projectId) {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return data || []
}

// Create a task
export async function createTask(projectId, task) {
    const user = await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    if (!task?.title?.trim()) {
        throw new Error('Task title is required.')
    }

    const allowedPriorities = ['low', 'medium', 'high']
    const priority = task.priority || 'medium'

    if (!allowedPriorities.includes(priority)) {
        throw new Error('Invalid task priority.')
    }

    const taskData = {
        project_id: projectId,
        title: task.title.trim(),
        description: task.description?.trim() || null,
        status: 'todo',
        priority,
        created_by: user.id,
        assignee_id: task.assignee_id || null,
        due_date: task.due_date || null,
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return data
}

// Update task status
export async function updateTaskStatus(taskId, status) {
    await getCurrentUser()

    const allowedStatuses = ['todo', 'in_progress', 'done']

    if (!taskId || !allowedStatuses.includes(status)) {
        throw new Error('Invalid task ID or status.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return data
}

// Assign or reassign a task
export async function updateTaskAssignee(taskId, assigneeId) {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({ assignee_id: assigneeId || null })
        .eq('id', taskId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return data
}
