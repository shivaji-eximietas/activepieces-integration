import { integrationHooks } from '../hooks/integration-hooks'

export function IntegrationHubPage() {
  const { data, isLoading, isError } = integrationHooks.useItems()

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Integration Hub</h1>
        <p className="text-sm text-gray-500">
          Data served by the standalone integration-service backend.
        </p>
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500">Loading...</div>
      )}

      {isError && (
        <div className="text-sm text-red-500">
          Could not reach the integration-service. Make sure it is running on port 4000.
        </div>
      )}

      {data && (
        <ul className="flex flex-col gap-2">
          {data.data.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-gray-200 px-4 py-3 text-sm"
            >
              <div className="font-medium">{item.name}</div>
              <div className="text-gray-400">{item.id}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
