import { apId, SeekPage } from '../shared'
import { FastifyPluginAsync } from 'fastify'

type IntegrationItem = {
    id: string
    name: string
    createdAt: string
}

const items: IntegrationItem[] = [
    { id: apId(), name: 'Sample integration', createdAt: new Date().toISOString() },
]

export const itemsController: FastifyPluginAsync = async (app) => {
    app.get('/', async (): Promise<SeekPage<IntegrationItem>> => {
        return {
            data: items,
            next: null,
            previous: null,
        }
    })
}
