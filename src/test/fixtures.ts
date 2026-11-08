// Typed test data builders, so tests can pass small, readable objects that
// still satisfy the app's types.
import type { User } from '@supabase/supabase-js'
import type { AuthContextValue } from '../context/useAuth'
import type { ProjectLabel, ProjectMember, Task } from '../types/app'

// For tests that deliberately pass an incomplete object where the code only
// reads a few fields (e.g. a user that only has an id).
export function partial<T>(value: Partial<T>): T {
    return value as T
}

export function makeUser(id = 'user-1'): User {
    return partial<User>({ id })
}

export function makeTask(overrides: Partial<Task> & { id: string }): Task {
    return {
        title: overrides.id,
        description: null,
        status: 'todo',
        priority: 'medium',
        assignee_id: null,
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'user-1',
        project_id: 'p1',
        updated_at: null,
        ...overrides,
    }
}

export function makeMember(overrides: Partial<ProjectMember> & { user_id: string }): ProjectMember {
    return {
        id: `member-${overrides.user_id}`,
        role: 'member',
        joined_at: null,
        full_name: overrides.user_id,
        avatar_url: null,
        ...overrides,
    }
}

export function makeLabel(overrides: Partial<ProjectLabel> & Pick<ProjectLabel, 'id' | 'name' | 'color'>): ProjectLabel {
    return {
        project_id: 'p1',
        created_at: '2026-11-09T00:00:00Z',
        ...overrides,
    }
}

export function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
    return {
        user: null,
        loading: false,
        signup: async () => partial({}),
        login: async () => partial({}),
        logout: async () => ({ error: null }),
        ...overrides,
    }
}

// A File whose reported size can be set without allocating that much data.
export function fakeFile(name: string, type: string, size: number): File {
    const file = new File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
}

// A faked result for `supabase.rpc(...)`. The mocked rpc's return type is a
// union over every database function's result, so a hand-written fake for
// one function cannot satisfy it; tests state the fake shape explicitly.
export function rpcResult(value: { data: unknown; error: unknown }): never {
    return value as never
}
