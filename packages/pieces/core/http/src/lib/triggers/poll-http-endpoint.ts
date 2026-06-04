import {
  createTrigger,
  TriggerStrategy,
  Property,
} from '@activepieces/pieces-framework';
import {
  DedupeStrategy,
  Polling,
  pollingHelper,
  httpClient,
  HttpMethod,
  AuthenticationType,
} from '@activepieces/pieces-common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

type PollHttpProps = {
  url: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  response_array_path?: string;
  timestamp_field?: string;
  auth_type: string;
  bearer_token?: string;
  basic_username?: string;
  basic_password?: string;
};

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const polling: Polling<undefined, PollHttpProps> = {
  strategy: DedupeStrategy.TIMEBASED,
  items: async ({ propsValue, lastFetchEpochMS }: { auth: undefined; store: unknown; propsValue: PollHttpProps; lastFetchEpochMS: number }) => {
    const {
      url,
      headers,
      query_params,
      response_array_path,
      timestamp_field,
      auth_type,
      bearer_token,
      basic_username,
      basic_password,
    } = propsValue;

    const requestHeaders: Record<string, string> = { ...(headers ?? {}) };

    let authentication = undefined;
    if (auth_type === 'BEARER' && bearer_token) {
      authentication = {
        type: AuthenticationType.BEARER_TOKEN as const,
        token: bearer_token,
      };
    } else if (auth_type === 'BASIC' && basic_username && basic_password) {
      authentication = {
        type: AuthenticationType.BASIC as const,
        username: basic_username,
        password: basic_password,
      };
    }

    const queryParams: Record<string, string> = { ...(query_params ?? {}) };

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers: requestHeaders,
      queryParams,
      authentication,
      timeout: 30000,
    });

    const body = response.body;
    let rawArray: unknown;

    if (response_array_path) {
      rawArray = getNestedValue(body, response_array_path);
    } else if (Array.isArray(body)) {
      rawArray = body;
    } else if (body && typeof body === 'object') {
      // Auto-detect: find the first array-valued property in the response
      const firstArrayProp = Object.values(body as Record<string, unknown>).find(Array.isArray);
      rawArray = firstArrayProp ?? [];
    } else {
      rawArray = [];
    }

    if (!Array.isArray(rawArray)) {
      return [];
    }

    return rawArray
      .filter((item) => {
        if (!timestamp_field) return true;
        const ts = getNestedValue(item, timestamp_field);
        if (!ts) return true;
        const epochMs = dayjs.utc(ts as string).valueOf();
        return epochMs > lastFetchEpochMS;
      })
      .map((item) => {
        const ts = timestamp_field ? getNestedValue(item, timestamp_field) : undefined;
        const epochMs = ts
          ? dayjs.utc(ts as string).valueOf()
          : Date.now();
        return {
          epochMilliSeconds: epochMs,
          data: item,
        };
      });
  },
};

export const pollHttpEndpointTrigger = createTrigger({
  name: 'poll_http_endpoint',
  displayName: 'Poll HTTP Endpoint',
  description: 'Periodically polls an HTTP GET endpoint and triggers when new items are found based on a timestamp field',
  type: TriggerStrategy.POLLING,
  props: {
    url: Property.ShortText({
      displayName: 'URL',
      description: 'The HTTP GET endpoint to poll',
      required: true,
    }),
    headers: Property.Object({
      displayName: 'Headers',
      description: 'Request headers (e.g. Content-Type, Accept)',
      required: false,
    }),
    query_params: Property.Object({
      displayName: 'Query Parameters',
      description: 'Query parameters to append to the URL',
      required: false,
    }),
    auth_type: Property.StaticDropdown({
      displayName: 'Authentication',
      required: true,
      defaultValue: 'NONE',
      options: {
        disabled: false,
        options: [
          { label: 'None', value: 'NONE' },
          { label: 'Bearer Token', value: 'BEARER' },
          { label: 'Basic Auth', value: 'BASIC' },
        ],
      },
    }),
    bearer_token: Property.ShortText({
      displayName: 'Bearer Token',
      description: 'Token to use for Bearer authentication',
      required: false,
    }),
    basic_username: Property.ShortText({
      displayName: 'Basic Auth Username',
      required: false,
    }),
    basic_password: Property.ShortText({
      displayName: 'Basic Auth Password',
      required: false,
    }),
    response_array_path: Property.ShortText({
      displayName: 'Response Array Path',
      description: 'Dot-notation path to the array in the response (e.g. "data.items"). Leave empty if the root response is an array.',
      required: false,
    }),
    timestamp_field: Property.ShortText({
      displayName: 'Timestamp Field',
      description: 'Optional. Dot-notation path to the timestamp field in each item for deduplication (e.g. "updated_at", "meta.createdDate"). Leave empty if your query params already filter by time.',
      required: false,
    }),
  },
  sampleData: {
    id: 1,
    name: 'Sample record',
    updated_at: '2026-01-01T00:00:00Z',
  },
  async onEnable(context) {
    await pollingHelper.onEnable(polling, {
      auth: undefined,
      store: context.store,
      propsValue: context.propsValue as unknown as PollHttpProps,
    });
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, {
      auth: undefined,
      store: context.store,
      propsValue: context.propsValue as unknown as PollHttpProps,
    });
  },
  async run(context) {
    return await pollingHelper.poll(polling, {
      auth: undefined,
      store: context.store,
      propsValue: context.propsValue as unknown as PollHttpProps,
      files: context.files,
    });
  },
  async test(context) {
    return await pollingHelper.test(polling, {
      auth: undefined,
      store: context.store,
      propsValue: context.propsValue as unknown as PollHttpProps,
      files: context.files,
    });
  },
});
