import { FastifyPluginAsync } from 'fastify'

export const healthController: FastifyPluginAsync = async (app) => {
    app.get('/', async () => {
        return {
            status: 'ok',
            service: 'integration-service',
            timestamp: new Date().toISOString(),
        }
    })
}
