import 'dotenv/config'
import { buildApp } from './app'

const PORT = Number(process.env['INTEGRATION_SERVICE_PORT'] ?? 4000)
const HOST = process.env['INTEGRATION_SERVICE_HOST'] ?? '0.0.0.0'

const start = async (): Promise<void> => {
    const app = await buildApp()
    try {
        await app.listen({ host: HOST, port: PORT })
    }
    catch (error) {
        app.log.error(error)
        process.exit(1)
    }
}

void start()
