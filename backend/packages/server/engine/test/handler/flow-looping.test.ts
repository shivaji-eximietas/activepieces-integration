import { FlowAction, FlowRunStatus, LoopStepOutput } from '@activepieces/shared'
import {  FlowExecutorContext } from '../../src/lib/handler/context/flow-execution-context'
import { flowExecutor } from '../../src/lib/handler/flow-executor'
import { buildCodeAction, buildSimpleLoopAction, generateMockEngineConstants } from './test-helper'


describe('flow with looping', () => {

    it('should execute iterations', async () => {
        const codeAction = buildCodeAction({
            name: 'echo_step',
            input: {
                'index': '{{loop.index}}',
            },
        })
        const result = await flowExecutor.execute({
            action: buildSimpleLoopAction({
                name: 'loop',
                loopItems: '{{ [4,5,6] }}',
                firstLoopAction: codeAction,
            }),
            executionState: FlowExecutorContext.empty(),
            constants: generateMockEngineConstants({ stepNames: ['loop'] }),
        })

        const loopOut = result.steps.loop as LoopStepOutput
        expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
        expect(loopOut.output?.iterations.length).toBe(3)
        expect(loopOut.output?.index).toBe(3)
        expect(loopOut.output?.item).toBe(6)
    })

    it('should execute iterations and fail on first iteration', async () => {
        const generateArray = buildCodeAction({
            name: 'echo_step',
            input: {
                'array': '{{ [4,5,6] }}',
            },
            nextAction: buildSimpleLoopAction({
                name: 'loop',
                loopItems: '{{ echo_step.array }}',
                firstLoopAction: buildCodeAction({
                    name: 'runtime',
                    input: {},
                }),
            }),
        })
        const result = await flowExecutor.execute({
            action: generateArray,
            executionState: FlowExecutorContext.empty(),
            constants: generateMockEngineConstants({ stepNames: ['echo_step'] }),
        })

        const loopOut = result.steps.loop as LoopStepOutput
        expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
        expect(loopOut.output?.iterations.length).toBe(1)
        expect(loopOut.output?.index).toBe(1)
        expect(loopOut.output?.item).toBe(4)
    })

    it('should skip loop', async () => {
        const result = await flowExecutor.execute({
            action: buildSimpleLoopAction({ name: 'loop', loopItems: '{{ [4,5,6] }}', skip: true }), executionState: FlowExecutorContext.empty(), constants: generateMockEngineConstants(),
        })
        expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.loop).toBeUndefined()
    })

    it('should skip loop in flow', async () => {
        const flow: FlowAction = {
            ...buildSimpleLoopAction({ name: 'loop', loopItems: '{{ [4,5,6] }}', skip: true }),
            nextAction: {
                ...buildCodeAction({
                    name: 'echo_step',
                    skip: false,
                    input: {
                        'key': '{{ 1 + 2 }}',
                    },
                }),
                nextAction: undefined,
            },
        }
        const result = await flowExecutor.execute({
            action: flow, executionState: FlowExecutorContext.empty(), constants: generateMockEngineConstants(),
        })
        expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.loop).toBeUndefined()
        expect(result.steps.echo_step.output).toEqual({ 'key': 3 })
    })

    it('should execute all iterations in parallel with concurrency > 1', async () => {
        const codeAction = buildCodeAction({
            name: 'echo_step',
            input: {
                index: '{{loop.index}}',
            },
        })
        const result = await flowExecutor.execute({
            action: buildSimpleLoopAction({
                name: 'loop',
                loopItems: '{{ [10,20,30,40,50] }}',
                concurrency: 3,
                firstLoopAction: codeAction,
            }),
            executionState: FlowExecutorContext.empty(),
            constants: generateMockEngineConstants({ stepNames: ['loop'] }),
        })

        const loopOut = result.steps.loop as LoopStepOutput
        expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
        expect(loopOut.output?.iterations.length).toBe(5)
        // All 5 iterations must have their child step output recorded
        for (let i = 0; i < 5; i++) {
            expect(loopOut.output?.iterations[i]['echo_step']).toBeDefined()
        }
    })

    it('should produce same iteration results with concurrency as sequential', async () => {
        const items = '[1,2,3,4,5,6]'
        const codeAction = buildCodeAction({
            name: 'echo_step',
            input: { val: '{{loop.item}}' },
        })

        const sequential = await flowExecutor.execute({
            action: buildSimpleLoopAction({
                name: 'loop',
                loopItems: `{{ ${items} }}`,
                firstLoopAction: codeAction,
            }),
            executionState: FlowExecutorContext.empty(),
            constants: generateMockEngineConstants({ stepNames: ['loop'] }),
        })

        const parallel = await flowExecutor.execute({
            action: buildSimpleLoopAction({
                name: 'loop',
                loopItems: `{{ ${items} }}`,
                concurrency: 3,
                firstLoopAction: codeAction,
            }),
            executionState: FlowExecutorContext.empty(),
            constants: generateMockEngineConstants({ stepNames: ['loop'] }),
        })

        const seqOut = sequential.steps.loop as LoopStepOutput
        const parOut = parallel.steps.loop as LoopStepOutput

        expect(parOut.output?.iterations.length).toBe(seqOut.output?.iterations.length)
        // Each iteration's echo_step output must match (duration excluded — timing-sensitive)
        for (let i = 0; i < seqOut.output!.iterations.length; i++) {
            const parStep = parOut.output?.iterations[i]['echo_step']
            const seqStep = seqOut.output?.iterations[i]['echo_step']
            expect(parStep?.output).toEqual(seqStep?.output)
            expect(parStep?.input).toEqual(seqStep?.input)
            expect(parStep?.status).toEqual(seqStep?.status)
        }
    })

})
