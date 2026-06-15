import { useQuery } from '@tanstack/react-query'

import { integrationApi } from '../api/integration-api'

export const integrationHooks = {
  useItems() {
    return useQuery({
      queryKey: ['integration-hub', 'items'],
      queryFn: () => integrationApi.listItems(),
    })
  },
}
