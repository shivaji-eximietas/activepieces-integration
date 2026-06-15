import { useTranslation } from 'react-i18next';

import { integrationHooks } from '../hooks/integration-hooks';

export function IntegrationHubPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = integrationHooks.useItems();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('Integration Hub')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Data served by the standalone integration-service backend.')}
        </p>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">{t('Loading...')}</div>
      )}

      {isError && (
        <div className="text-sm text-destructive">
          {t('Could not reach the integration-service.')}
        </div>
      )}

      {data && (
        <ul className="flex flex-col gap-2">
          {data.data.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border px-4 py-3 text-sm"
            >
              <div className="font-medium">{item.name}</div>
              <div className="text-muted-foreground">{item.id}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
