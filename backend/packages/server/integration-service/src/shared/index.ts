import { randomUUID } from 'node:crypto'

export const apId = (): string => randomUUID()

export type SeekPage<T> = {
    data: T[]
    next: string | null
    previous: string | null
}
