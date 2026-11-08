import { supabase } from './supabase'
import { getCurrentUser } from './auth'

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

const ALLOWED_PRIORITIES = ['low', 'medium', 'high']

// Edit a task's details (title, description, priority, assignee, due date).
export async function updateTask(taskId, task) {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const title = task?.title?.trim()

    if (!title) {
        throw new Error('Task title is required.')
    }

    const priority = task.priority || 'medium'

    if (!ALLOWED_PRIORITIES.includes(priority)) {
        throw new Error('Invalid task priority.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({
            title,
            description: task.description?.trim() || null,
            priority,
            assignee_id: task.assignee_id || null,
            due_date: task.due_date || null,
        })
        .eq('id', taskId)
        .select()
        .maybeSingle()

    if (error) throw new Error(error.message)

    // Row Level Security returns no row (rather than an error) when the
    // user is not allowed to change this task.
    if (!data) {
        throw new Error(
            'Task was not updated. It may have been deleted, or you may not have permission to edit it.'
        )
    }

    return data
}

// Delete a task. Whether its comments are removed with it depends on the
// database foreign key (ON DELETE CASCADE); otherwise Supabase returns an error.
export async function deleteTask(taskId) {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .select('id')

    if (error) throw new Error(error.message)

    if (!data || data.length === 0) {
        throw new Error(
            'Task was not deleted. It may already be gone, or you may not have permission to delete it.'
        )
    }

    return true
}
