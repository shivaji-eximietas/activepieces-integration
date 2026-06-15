import cors from '@fastify/cors'
import fastify, { FastifyInstance } from 'fastify'

import { healthController } from './health/health.controller'
import { itemsController } from './items/items.controller'

export const buildApp = async (): Promise<FastifyInstance> => {
    const app = fastify({
        logger: true,
    })

    await app.register(cors, {
        origin: true,
        credentials: true,
    })

    await app.register(healthController, { prefix: '/v1/health' })
    await app.register(itemsController, { prefix: '/v1/items' })

    return app
}
