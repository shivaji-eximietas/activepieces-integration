import { loopBatchUtils } from '../../../src/lib/automation/flows/util/loop-batch-utils'

describe('loopBatchUtils', () => {
    it('splitItemsIntoBatches keeps one item per iteration when batch size is unset', () => {
        const result = loopBatchUtils.splitItemsIntoBatches({
            items: [1, 2, 3],
        })
        expect(result.batchSize).toBe(1)
        expect(result.batches).toEqual([[1], [2], [3]])
    })

    it('splitItemsIntoBatches groups items when batch size is greater than 1', () => {
        const result = loopBatchUtils.splitItemsIntoBatches({
            items: [1, 2, 3, 4, 5],
            batchSize: 2,
        })
        expect(result.batchSize).toBe(2)
        expect(result.batches).toEqual([[1, 2], [3, 4], [5]])
    })

    it('buildIterationContext exposes an array item for batch mode', () => {
        const context = loopBatchUtils.buildIterationContext({
            batch: [10, 11],
            batchIndex: 1,
            batchSize: 2,
            totalBatches: 3,
        })
        expect(context.item).toEqual([10, 11])
        expect(context.index).toBe(2)
        expect(context.batchSize).toBe(2)
        expect(context.batchIndex).toBe(1)
        expect(context.totalBatches).toBe(3)
        expect(context.itemStartIndex).toBe(3)
    })

    it('buildIterationContext keeps scalar item when batch size is 1', () => {
        const context = loopBatchUtils.buildIterationContext({
            batch: [7],
            batchIndex: 0,
            batchSize: 1,
            totalBatches: 1,
        })
        expect(context.item).toBe(7)
        expect(context.index).toBe(1)
        expect(context.batchSize).toBeUndefined()
    })

    it('splitItemsIntoBatches rejects invalid batch sizes', () => {
        const result = loopBatchUtils.splitItemsIntoBatches({
            items: [1, 2],
            batchSize: 0,
        })
        expect(result.errorMessage).toContain('Batch size must be a positive whole number')
    })
})
