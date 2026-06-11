import { Property, DynamicPropsValue, PieceAuth, AppConnectionValueForAuthProperty } from '@activepieces/pieces-framework';
import { ServiceNowClient } from './client';

export const servicenowAuth = PieceAuth.CustomAuth({
  required: true,
  props: {
    instanceUrl: Property.ShortText({
      displayName: 'Instance URL',
      description: 'Your ServiceNow instance URL without trailing slash (e.g., https://dev12345.service-now.com)',
      required: true,
    }),
    username: Property.ShortText({
      displayName: 'Username',
      description: 'Your ServiceNow username (not email)',
      required: true,
    }),
    password: Property.ShortText({
      displayName: 'Password',
      description: 'Your ServiceNow password (not API token)',
      required: true,
    }),
  },
});

export const tableDropdown = Property.Dropdown({
  auth: servicenowAuth,
  displayName: 'Table',
  description: 'ServiceNow table to work with. Type a custom table name if not listed.',
  required: true,
  refreshers: [],
  options: async ({ auth }) => {
    if (!auth) {
      return {
        disabled: true,
        placeholder: 'Please connect your ServiceNow account first',
        options: [],
      };
    }

    const tables = [
      { label: 'Incident (incident)', value: 'incident' },
      { label: 'Change Request (change_request)', value: 'change_request' },
      { label: 'Problem (problem)', value: 'problem' },
      { label: 'Service Request (sc_request)', value: 'sc_request' },
      { label: 'Request Item (sc_req_item)', value: 'sc_req_item' },
      { label: 'Task (task)', value: 'task' },
      { label: 'User (sys_user)', value: 'sys_user' },
      { label: 'User Group (sys_user_group)', value: 'sys_user_group' },
      { label: 'Configuration Item (cmdb_ci)', value: 'cmdb_ci' },
      { label: 'CI Service (cmdb_ci_service)', value: 'cmdb_ci_service' },
      { label: 'Change Task (change_task)', value: 'change_task' },
      { label: 'Hardware Asset (alm_hardware)', value: 'alm_hardware' },
      { label: 'Software Asset (alm_software)', value: 'alm_software' },
      { label: 'Knowledge Article (kb_knowledge)', value: 'kb_knowledge' },
      { label: 'Customer Service Case (sn_customerservice_case)', value: 'sn_customerservice_case' },
      { label: 'Catalog Item (sc_cat_item)', value: 'sc_cat_item' },
      { label: 'Choice (sys_choice)', value: 'sys_choice' },
      { label: 'Company (core_company)', value: 'core_company' },
      { label: 'Contract (ast_contract)', value: 'ast_contract' },
      { label: 'Expense Line (fm_expense_line)', value: 'fm_expense_line' },
    ];

    return {
      disabled: false,
      options: tables,
    };
  },
});

export const recordDropdown = Property.Dropdown({
  auth: servicenowAuth,
  displayName: 'Record',
  description: 'Select a record from the table',
  required: true,
  refreshers: ['table'],
  options: async ({ auth, table }) => {
    if (!auth || !table) {
      return {
        disabled: true,
        placeholder: 'Please select a table first',
        options: [],
      };
    }

    try {
      const authObj = auth as Record<string, unknown>;
      const props = (authObj['props'] as Record<string, string> | undefined) ?? authObj;
      const client = new ServiceNowClient({
        instanceUrl: (props['instanceUrl'] as string) || '',
        auth: {
          type: 'basic',
          username: (props['username'] as string) || '',
          password: (props['password'] as string) || '',
        },
      });

      const records = await client.getRecordsForDropdown(table as string);
      return {
        disabled: false,
        options: records,
      };
    } catch (e) {
      return {
        disabled: true,
        placeholder: `Failed to load records: ${e instanceof Error ? e.message : 'Unknown error'}`,
        options: [],
      };
    }
  },
});

export const catalogItemDropdown = Property.Dropdown({
  auth: servicenowAuth,
  displayName: 'Catalog Item',
  description: 'Select a catalog item to order',
  required: true,
  refreshers: [],
  options: async ({ auth }) => {
    if (!auth) {
      return {
        disabled: true,
        placeholder: 'Please connect your ServiceNow account first',
        options: [],
      };
    }

    try {
      const authObj = auth as Record<string, unknown>;
      const props = (authObj['props'] as Record<string, string> | undefined) ?? authObj;
      const client = new ServiceNowClient({
        instanceUrl: (props['instanceUrl'] as string) || '',
        auth: {
          type: 'basic',
          username: (props['username'] as string) || '',
          password: (props['password'] as string) || '',
        },
      });

      const items = await client.listCatalogItems({ limit: 100 });
      return {
        disabled: false,
        options: items.map((item) => ({
          label: item.name
            ? `${item.name} (${item.sys_id})`
            : item.sys_id,
          value: item.sys_id,
        })),
      };
    } catch {
      return {
        disabled: true,
        placeholder:
          'Failed to load catalog items. Check your credentials and ensure the Service Catalog API is enabled.',
        options: [],
      };
    }
  },
});

export function createServiceNowClient(auth: AppConnectionValueForAuthProperty<typeof servicenowAuth>): ServiceNowClient {
  return new ServiceNowClient({
    instanceUrl: auth.props.instanceUrl,
    auth: {
      type: 'basic',
      username: auth.props.username,
      password: auth.props.password,
    },
  });
}

export function resolveSysId({
  selected,
  manual,
  label = 'record',
}: {
  selected: string | undefined;
  manual: string | undefined;
  label?: string;
}): string {
  const value = selected || manual;
  if (!value) {
    throw new Error(
      `Either ${label} selection or manual sys_id must be provided`
    );
  }
  return value;
}