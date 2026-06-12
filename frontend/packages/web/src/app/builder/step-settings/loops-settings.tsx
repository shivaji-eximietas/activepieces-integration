import { LoopOnItemsAction } from '@activepieces/shared';
import { t } from 'i18next';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { TextInputWithMentions } from '../piece-properties/text-input-with-mentions';

type LoopsSettingsProps = {
  readonly: boolean;
};

const LoopsSettings = React.memo(({ readonly }: LoopsSettingsProps) => {
  const form = useFormContext<LoopOnItemsAction>();
  const [batchSizeText, setBatchSizeText] = useState(
    form.getValues('settings.batchSize')?.toString() ?? '',
  );
  const [concurrencyText, setConcurrencyText] = useState(
    form.getValues('settings.concurrency')?.toString() ?? '',
  );

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={form.control}
        name="settings.items"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel showRequiredIndicator>{t('Items')}</FormLabel>
            <TextInputWithMentions
              disabled={readonly}
              onChange={field.onChange}
              initialValue={field.value}
              placeholder={t('Select an array of items')}
            ></TextInputWithMentions>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="settings.batchSize"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel>{t('Batch size')}</FormLabel>
            <Input
              type="text"
              inputMode="numeric"
              disabled={readonly}
              value={batchSizeText}
              placeholder={t('loopConcurrencyPlaceholder')}
              onChange={(event) => {
                const rawValue = event.target.value.replace(/\D/g, '');
                setBatchSizeText(rawValue);
                const parsedValue = Number.parseInt(rawValue, 10);
                field.onChange(
                  Number.isNaN(parsedValue) ? undefined : parsedValue,
                );
              }}
            />
            <p className="text-sm text-muted-foreground">
              {t('loopBatchSizeHelp')}
            </p>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="settings.concurrency"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel>{t('Concurrency')}</FormLabel>
            <Input
              type="text"
              inputMode="numeric"
              disabled={readonly}
              value={concurrencyText}
              placeholder={t('loopConcurrencyPlaceholder')}
              onChange={(event) => {
                const rawValue = event.target.value.replace(/\D/g, '');
                setConcurrencyText(rawValue);
                const parsedValue = Number.parseInt(rawValue, 10);
                field.onChange(
                  Number.isNaN(parsedValue) ? undefined : parsedValue,
                );
              }}
            />
            <p className="text-sm text-muted-foreground">
              {t('loopConcurrencyHelp')}
            </p>
          </FormItem>
        )}
      />
    </div>
  );
});

LoopsSettings.displayName = 'LoopsSettings';
export { LoopsSettings };
