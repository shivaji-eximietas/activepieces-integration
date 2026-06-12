import { LATEST_CONTEXT_VERSION } from '@activepieces/pieces-framework'
import {
    FlowActionType,
    flowStructureUtil,
    FlowTriggerType,
    FlowVersion,
    GenericStepOutput,
    isNil,
    loopBatchUtils,
    LoopStepOutput,
    RouterStepOutput,
    spreadIfDefined,
    StepOutputStatus,
} from '@activepieces/shared'
import { createPropsResolver } from '../../variables/props-resolver'
import { EngineConstants } from './engine-constants'
import { FlowExecutorContext } from './flow-execution-context'

export const testExecutionContext = {
    async stateFromFlowVersion({
        flowVersion,
        excludedStepName,
        projectId,
        engineToken,
        apiUrl,
        sampleData,
        engineConstants,
    }: TestExecutionParams): Promise<FlowExecutorContext> {
        let flowExecutionContext = FlowExecutorContext.empty({
            engineApi: { engineToken, internalApiUrl: apiUrl },
            slicingEnabled: false,
        })
        if (isNil(flowVersion)) {
            return flowExecutionContext
        }
        
        const flowSteps = flowStructureUtil.getAllSteps(flowVersion.trigger)

        for (const step of flowSteps) {
            const { name } = step
            if (name === excludedStepName) {
                continue
            }

            const stepType = step.type
            switch (stepType) {
                case FlowActionType.ROUTER:
                    flowExecutionContext = await flowExecutionContext.upsertStep(
                        step.name,
                        RouterStepOutput.create({
                            input: step.settings,
                            type: stepType,
                            status: StepOutputStatus.SUCCEEDED,
                            ...spreadIfDefined('output', sampleData?.[step.name]),
                        }),
                    )
                    break
                case FlowActionType.LOOP_ON_ITEMS: {
                    const { resolvedInput } = await createPropsResolver({
                        apiUrl,
                        projectId,
                        engineToken,
                        contextVersion: LATEST_CONTEXT_VERSION,
                        stepNames: engineConstants.stepNames,
                    }).resolve<{ items: unknown[] }>({
                        unresolvedInput: step.settings,
                        executionState: flowExecutionContext,
                    })
                    const { batches, batchSize: effectiveBatchSize } = loopBatchUtils.splitItemsIntoBatches({
                        items: Array.isArray(resolvedInput.items) ? resolvedInput.items : [],
                        batchSize: step.settings.batchSize,
                    })
                    const firstBatch = batches[0] ?? []
                    const iterationContext = loopBatchUtils.buildIterationContext({
                        batch: firstBatch,
                        batchIndex: 0,
                        batchSize: effectiveBatchSize,
                        totalBatches: batches.length,
                    })
                    flowExecutionContext = await flowExecutionContext.upsertStep(
                        step.name,
                        LoopStepOutput.init({
                            input: step.settings,
                        }).setOutput({
                            ...iterationContext,
                            iterations: [],
                        }),
                    )
                    break
                }
                case FlowActionType.PIECE:
                case FlowActionType.CODE:
                case FlowTriggerType.EMPTY:
                case FlowTriggerType.PIECE:
                    flowExecutionContext = await flowExecutionContext.upsertStep(step.name, GenericStepOutput.create({
                        input: {},
                        type: stepType,
                        status: StepOutputStatus.SUCCEEDED,
                        ...spreadIfDefined('output', sampleData?.[step.name]),
                    }))
                    break
            }
        }
        return flowExecutionContext
    },
}


type TestExecutionParams = {
    engineConstants: EngineConstants
    flowVersion?: FlowVersion
    excludedStepName?: string
    projectId: string
    apiUrl: string
    engineToken: string
    sampleData?: Record<string, unknown>
}