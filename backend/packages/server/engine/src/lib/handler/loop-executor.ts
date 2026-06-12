import { LATEST_CONTEXT_VERSION } from '@activepieces/pieces-framework'
import { chunk, FlowActionType, FlowRunStatus, isNil, loopBatchUtils, LoopOnItemsAction, LoopStepOutput, StepOutput, StepOutputStatus } from '@activepieces/shared'
import { BaseExecutor } from './base-executor'
import { FlowExecutorContext } from './context/flow-execution-context'
import { flowExecutor } from './flow-executor'

type LoopOnActionResolvedSettings = {
    items: readonly unknown[]
}

export const loopExecutor: BaseExecutor<LoopOnItemsAction> = {
    async handle({
        action,
        executionState,
        constants,
    }) {
        const stepStartTime = performance.now()
        const { resolvedInput, censoredInput } = await constants.getPropsResolver(LATEST_CONTEXT_VERSION).resolve<LoopOnActionResolvedSettings>({
            unresolvedInput: {
                items: action.settings.items,
            },
            executionState,
        })
        const loopInput = {
            items: censoredInput,
        }
        const previousStepOutput = executionState.getLoopStepOutput({ stepName: action.name })
        let stepOutput = previousStepOutput ?? LoopStepOutput.init({
            input: loopInput,
        })
        let newExecutionContext = await executionState.upsertStep(action.name, stepOutput)

        if (!Array.isArray(resolvedInput.items)) {
            const errorMessage = JSON.stringify({
                message: 'The items you have selected must be a list.',
            })
            const failedStepOutput = stepOutput
                .setStatus(StepOutputStatus.FAILED)
                .setErrorMessage(errorMessage)
                .setDuration(performance.now() - stepStartTime)
            return (await newExecutionContext.upsertStep(action.name, failedStepOutput)).setVerdict({ status: FlowRunStatus.FAILED, failedStep: {
                name: action.name,
                displayName: action.displayName,
                message: errorMessage,
            } })
        }

        const { batches, batchSize, errorMessage: batchErrorMessage } = loopBatchUtils.splitItemsIntoBatches({
            items: resolvedInput.items,
            batchSize: action.settings.batchSize,
        })

        if (batchErrorMessage) {
            const failedStepOutput = stepOutput
                .setStatus(StepOutputStatus.FAILED)
                .setErrorMessage(batchErrorMessage)
                .setDuration(performance.now() - stepStartTime)
            return (await newExecutionContext.upsertStep(action.name, failedStepOutput)).setVerdict({
                status: FlowRunStatus.FAILED,
                failedStep: {
                    name: action.name,
                    displayName: action.displayName,
                    message: batchErrorMessage,
                },
            })
        }

        const firstLoopAction = action.firstLoopAction
        const concurrency = action.settings.concurrency ?? 1
        const testSingleStepMode = !isNil(constants.stepNameToTest)

        if (concurrency <= 1) {
            for (let i = 0; i < batches.length; ++i) {
                const newCurrentPath = newExecutionContext.currentPath.loopIteration({ loopName: action.name, iteration: i })

                const iterationContext = loopBatchUtils.buildIterationContext({
                    batch: batches[i],
                    batchIndex: i,
                    batchSize,
                    totalBatches: batches.length,
                })
                stepOutput = stepOutput.setItemAndIndex(iterationContext)
                const addEmptyIteration = !stepOutput.hasIteration(i)
                if (addEmptyIteration) {
                    stepOutput = stepOutput.addIteration()
                }
                newExecutionContext = (await newExecutionContext.upsertStep(action.name, stepOutput)).setCurrentPath(newCurrentPath)
                if (!isNil(firstLoopAction) && !testSingleStepMode) {
                    newExecutionContext = await flowExecutor.execute({
                        action: firstLoopAction,
                        executionState: newExecutionContext,
                        constants,
                    })
                }

                newExecutionContext = newExecutionContext.setCurrentPath(newExecutionContext.currentPath.removeLast())

                if (newExecutionContext.verdict.status !== FlowRunStatus.RUNNING) {
                    return newExecutionContext.upsertStep(action.name, stepOutput.setDuration(performance.now() - stepStartTime))
                }

                if (testSingleStepMode) {
                    break
                }
            }
        }
        else {
            const concurrencyGroups = chunk(
                Array.from({ length: batches.length }, (_, i) => i),
                concurrency,
            )

            for (const group of concurrencyGroups) {
                if (testSingleStepMode) {
                    // Mirror sequential test mode: show first item/index, one empty slot, then stop.
                    const firstIterCtx = loopBatchUtils.buildIterationContext({
                        batch: batches[group[0]],
                        batchIndex: group[0],
                        batchSize,
                        totalBatches: batches.length,
                    })
                    stepOutput = stepOutput.setItemAndIndex(firstIterCtx).addIteration()
                    newExecutionContext = await newExecutionContext.upsertStep(action.name, stepOutput)
                    break
                }

                // Pre-allocate empty iteration slots for all indices in this concurrent group.
                // Do NOT call setItemAndIndex here — each parallel context needs its own item/index.
                for (const i of group) {
                    if (!stepOutput.hasIteration(i)) {
                        stepOutput = stepOutput.addIteration()
                    }
                }
                newExecutionContext = await newExecutionContext.upsertStep(action.name, stepOutput)

                if (!isNil(firstLoopAction)) {
                    // Each iteration runs in isolation: deep-clone steps so concurrent mutations
                    // (writing child step outputs into iterations[i]) don't interfere.
                    // After cloning, patch item/index in the loop step output for that specific
                    // iteration so that variable resolution (e.g. {{loop.item}}) is correct.
                    const parallelResults = await Promise.all(
                        group.map(async (i) => {
                            const iterCtx = loopBatchUtils.buildIterationContext({
                                batch: batches[i],
                                batchIndex: i,
                                batchSize,
                                totalBatches: batches.length,
                            })
                            const iterPath = newExecutionContext.currentPath.loopIteration({
                                loopName: action.name,
                                iteration: i,
                            })
                            const isolatedSteps = JSON.parse(JSON.stringify(newExecutionContext.steps)) as Record<string, StepOutput>
                            patchLoopItemInIsolatedSteps({ steps: isolatedSteps, loopName: action.name, iterCtx })
                            const isolatedContext = new FlowExecutorContext({
                                ...newExecutionContext,
                                steps: isolatedSteps,
                                currentPath: iterPath,
                            })
                            return flowExecutor.execute({
                                action: firstLoopAction,
                                executionState: isolatedContext,
                                constants,
                            })
                        }),
                    )

                    // Merge each iteration's step outputs from the isolated contexts back into
                    // the main step output. Each result.steps[loopName].output.iterations[i]
                    // holds the child step outputs written during that iteration.
                    const mergedIterations = [...(stepOutput.output?.iterations ?? [])]
                    let failedResult: FlowExecutorContext | undefined

                    for (let j = 0; j < group.length; j++) {
                        const i = group[j]
                        const result = parallelResults[j]
                        const iterationData = (result.steps[action.name] as LoopStepOutput).output?.iterations[i]
                        if (iterationData) {
                            mergedIterations[i] = iterationData
                        }
                        if (result.verdict.status !== FlowRunStatus.RUNNING && isNil(failedResult)) {
                            failedResult = result
                        }
                    }

                    // Set the final item/index to the last element in the group (consistent
                    // with sequential behaviour where item/index reflect the last iteration).
                    const lastI = group[group.length - 1]
                    const lastIterCtx = loopBatchUtils.buildIterationContext({
                        batch: batches[lastI],
                        batchIndex: lastI,
                        batchSize,
                        totalBatches: batches.length,
                    })
                    stepOutput = stepOutput.setItemAndIndex(lastIterCtx).setIterations(mergedIterations)
                    newExecutionContext = await newExecutionContext.upsertStep(action.name, stepOutput)

                    if (!isNil(failedResult)) {
                        return (await newExecutionContext.upsertStep(
                            action.name,
                            stepOutput.setDuration(performance.now() - stepStartTime),
                        )).setVerdict(failedResult.verdict)
                    }
                }
            }
        }

        return newExecutionContext.upsertStep(action.name, stepOutput.setDuration(performance.now() - stepStartTime))
    },
}

function patchLoopItemInIsolatedSteps({
    steps,
    loopName,
    iterCtx,
}: {
    steps: Record<string, StepOutput>
    loopName: string
    iterCtx: ReturnType<typeof loopBatchUtils.buildIterationContext>
}): void {
    const loopStep = steps[loopName]
    if (isNil(loopStep) || loopStep.type !== FlowActionType.LOOP_ON_ITEMS || isNil(loopStep.output)) {
        return
    }
    loopStep.output.item = iterCtx.item
    loopStep.output.index = iterCtx.index
    loopStep.output.batchSize = 'batchSize' in iterCtx ? iterCtx.batchSize : undefined
    loopStep.output.batchIndex = 'batchIndex' in iterCtx ? iterCtx.batchIndex : undefined
    loopStep.output.totalBatches = 'totalBatches' in iterCtx ? iterCtx.totalBatches : undefined
    loopStep.output.itemStartIndex = 'itemStartIndex' in iterCtx ? iterCtx.itemStartIndex : undefined
}
