import { CustomProperty as CustomPropertyType } from '@activepieces/pieces-framework';
import { flowStructureUtil } from '@activepieces/shared';
import { useEffect, useId } from 'react';

import { useEmbedding } from '@/components/providers/embed-provider';
import { projectCollectionUtils } from '@/features/projects';

import { useBuilderStateContext } from '../builder-hooks';
const CUSTOM_PROPERTY_CONTAINER_ID = 'custom-property-container';

type CustomPropertyParams = {
  value: unknown;
  onChange: (value: unknown) => void;
  code: string;
  disabled: boolean;
  property: CustomPropertyType<boolean>;
};

const parseFunctionString = (code: string) => {
  return new Function(
    'params',
    `
    return (${code})(params);
  `,
  );
};
const CustomProperty = ({
  value,
  onChange,
  code,
  disabled,
  property,
}: CustomPropertyParams) => {
  const { project } = projectCollectionUtils.useCurrentProject();
  const { embedState } = useEmbedding();
  const id = useId();
  const containerId = CUSTOM_PROPERTY_CONTAINER_ID + '-' + id;

  const flowVersion = useBuilderStateContext((state) => state.flowVersion);
  const outputSampleData = useBuilderStateContext(
    (state) => state.outputSampleData,
  );
  const selectedStep = useBuilderStateContext((state) => state.selectedStep);

  useEffect(() => {
    try {
      const flowSteps: { name: string; displayName: string }[] = [];
      if (flowVersion?.trigger && selectedStep) {
        const pathToStep = flowStructureUtil.findPathToStep(
          flowVersion.trigger,
          selectedStep,
        );
        pathToStep.forEach((step) => {
          flowSteps.push({
            name: step.name,
            displayName: step.displayName,
          });
        });
      }

      const params = {
        containerId,
        value,
        onChange,
        isEmbedded: embedState.isEmbedded,
        projectId: project.id,
        disabled,
        property,
        flowSteps,
        stepSampleData: outputSampleData as Record<string, unknown>,
      };
      // Create function that takes a params object
      const fn = parseFunctionString(code);
      // Execute the function with args as the params object
      const cleanUpFunction = fn(params);
      if (cleanUpFunction && typeof cleanUpFunction === 'function') {
        return cleanUpFunction;
      }
    } catch (error) {
      console.error('Error executing custom code:', error);
    }
  }, []);
  return <div id={containerId}></div>;
};

CustomProperty.displayName = 'CustomProperty';
export default CustomProperty;
