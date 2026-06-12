import { chunk } from '../../../core/common/utils/utils'

function normalizeBatchSize({ batchSize }: { batchSize?: number }): number {
    if (batchSize === undefined) {
        return 1
    }
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        return Number.NaN
    }
    return batchSize
}

function resolveLoopIterationItem({
    batch,
    batchSize,
}: {
    batch: readonly unknown[]
    batchSize: number
}): unknown {
    if (batchSize <= 1) {
        return batch[0]
    }
    return [...batch]
}

export const loopBatchUtils = {
    normalizeBatchSize,
    resolveLoopIterationItem,
    splitItemsIntoBatches({
        items,
        batchSize,
    }: {
        items: readonly unknown[]
        batchSize?: number
    }): {
        batches: readonly (readonly unknown[])[]
        batchSize: number
        errorMessage?: string
    } {
        const normalizedBatchSize = normalizeBatchSize({ batchSize })
        if (Number.isNaN(normalizedBatchSize)) {
            return {
                batches: [],
                batchSize: 1,
                errorMessage: JSON.stringify({
                    message: 'Batch size must be a positive whole number.',
                }),
            }
        }

        if (normalizedBatchSize <= 1) {
            return {
                batches: items.map((item) => [item]),
                batchSize: 1,
            }
        }

        return {
            batches: chunk([...items], normalizedBatchSize),
            batchSize: normalizedBatchSize,
        }
    },
    buildIterationContext({
        batch,
        batchIndex,
        batchSize,
        totalBatches,
    }: {
        batch: readonly unknown[]
        batchIndex: number
        batchSize: number
        totalBatches: number
    }) {
        const item = resolveLoopIterationItem({ batch, batchSize })
        const index = batchIndex + 1
        if (batchSize <= 1) {
            return { item, index }
        }
        return {
            item,
            index,
            batchSize,
            batchIndex,
            totalBatches,
            itemStartIndex: batchIndex * batchSize + 1,
        }
    },
}

export type LoopIterationContext = ReturnType<typeof loopBatchUtils.buildIterationContext>
