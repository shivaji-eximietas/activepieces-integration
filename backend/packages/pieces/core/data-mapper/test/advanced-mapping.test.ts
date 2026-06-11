/// <reference types="vitest/globals" />

import { advancedMapping } from '../src/lib/actions/advanced-mapping';
import { createMockActionContext } from '@activepieces/pieces-framework';

describe('advancedMapping', () => {
  test('extracts mapping from stored value', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'step_1',
          inputFields: ['caller_id.display_value', 'state.display_value'],
          inputTypes: { 'caller_id.display_value': 'string', 'state.display_value': 'string' },
          outputFields: ['data.name', 'data.sys_status'],
          outputTypes: { 'data.name': 'string', 'data.sys_status': 'string' },
          connections: {
            'data.name': ['caller_id.display_value'],
            'data.sys_status': ['state.display_value'],
          },
          mapping: {
            data: {
              name: "{{step_1['caller_id']['display_value']}}",
              sys_status: "{{step_1['state']['display_value']}}",
            },
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({
      data: {
        name: "{{step_1['caller_id']['display_value']}}",
        sys_status: "{{step_1['state']['display_value']}}",
      },
    });
  });

  test('returns empty object when no mapping', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'trigger',
          inputFields: [],
          inputTypes: {},
          outputFields: [],
          outputTypes: {},
          connections: {},
          mapping: {},
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({});
  });

  test('returns empty object for null value', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: null,
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({});
  });

  test('handles multi-field joining', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'step_2',
          inputFields: ['first_name', 'last_name'],
          inputTypes: { first_name: 'string', last_name: 'string' },
          outputFields: ['full_name'],
          outputTypes: { full_name: 'string' },
          connections: { full_name: ['first_name', 'last_name'] },
          mapping: {
            full_name: "{{step_2['first_name']}} {{step_2['last_name']}}",
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({
      full_name: "{{step_2['first_name']}} {{step_2['last_name']}}",
    });
  });

  test('applies transforms to resolved values', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'step_1',
          inputFields: ['short_description'],
          inputTypes: { short_description: 'string' },
          outputFields: ['data'],
          outputTypes: { data: 'object' },
          connections: { data: ['short_description'] },
          transforms: { data: ['toString', 'toUpperCase'] },
          mapping: {
            data: {
              __value: 'hello world',
              __transforms: ['toString', 'toUpperCase'],
            },
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({ data: 'HELLO WORLD' });
  });

  test('applies trim transform', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'step_1',
          inputFields: ['name'],
          inputTypes: { name: 'string' },
          outputFields: ['clean_name'],
          outputTypes: { clean_name: 'string' },
          connections: { clean_name: ['name'] },
          transforms: { clean_name: ['trim', 'toLowerCase'] },
          mapping: {
            clean_name: {
              __value: '  Hello World  ',
              __transforms: ['trim', 'toLowerCase'],
            },
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({ clean_name: 'hello world' });
  });

  test('passes through plain values without transforms', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'step_1',
          inputFields: ['id'],
          inputTypes: { id: 'number' },
          outputFields: ['record_id'],
          outputTypes: { record_id: 'number' },
          connections: { record_id: ['id'] },
          transforms: {},
          mapping: {
            record_id: "{{step_1['id']}}",
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({ record_id: "{{step_1['id']}}" });
  });

  test('simulates real execution with engine-resolved values', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'trigger',
          inputFields: ['caller_id.display_value', 'short_description', 'state'],
          inputTypes: { 'caller_id.display_value': 'string', short_description: 'string', state: 'string' },
          outputFields: ['data.name', 'data.description', 'data.status'],
          outputTypes: { 'data.name': 'string', 'data.description': 'string', 'data.status': 'string' },
          connections: {
            'data.name': ['caller_id.display_value'],
            'data.description': ['short_description'],
            'data.status': ['state'],
          },
          transforms: { 'data.name': ['toUpperCase'] },
          mapping: {
            data: {
              name: { __value: 'John Smith', __transforms: ['toUpperCase'] },
              description: 'Server is down',
              status: 'New',
            },
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({
      data: {
        name: 'JOHN SMITH',
        description: 'Server is down',
        status: 'New',
      },
    });
  });

  test('debug output when all values are empty', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'trigger',
          inputFields: ['upon_reject'],
          inputTypes: { upon_reject: 'string' },
          outputFields: ['data.field'],
          outputTypes: { 'data.field': 'string' },
          connections: { 'data.field': ['upon_reject'] },
          transforms: {},
          mapping: {
            data: { field: '' },
          },
        },
      },
    });
    const result = await advancedMapping.run(ctx);
    expect(result).toHaveProperty('_debug');
    expect(result._debug.message).toContain('resolved to empty');
    expect(result._debug.stepRef).toBe('trigger');
  });

  test('removes null, undefined and empty strings when sanitization is enabled', async () => {
    const ctx = createMockActionContext({
      propsValue: {
        mapping: {
          stepRef: 'trigger',
          inputFields: ['name', 'description', 'status'],
          inputTypes: { name: 'string', description: 'string', status: 'string' },
          outputFields: ['data.name', 'data.description', 'data.status', 'data.code'],
          outputTypes: {
            'data.name': 'string',
            'data.description': 'string',
            'data.status': 'string',
            'data.code': 'string',
          },
          connections: {
            'data.name': ['name'],
            'data.description': ['description'],
            'data.status': ['status'],
            'data.code': ['status'],
          },
          transforms: {},
          excludeEmptyValues: true,
          mapping: {
            data: {
              name: 'Alice',
              description: '',
              status: null,
              code: undefined,
            },
          },
        },
      },
    });

    const result = await advancedMapping.run(ctx);
    expect(result).toEqual({
      data: {
        name: 'Alice',
      },
    });
  });
});
