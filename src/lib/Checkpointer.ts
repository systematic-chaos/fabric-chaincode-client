import { Checkpointer as ICheckpointer } from 'fabric-network';

import Long from 'long';

export class Checkpointer implements ICheckpointer {

    private currentBlock: number|undefined;
    private blocks: {[key: number]: Set<string>};

    public constructor(private cachePreviousBlocks: boolean = true) {
        this.currentBlock = undefined;
        this.blocks = {};
    }
    
    /**
     * Add a transaction ID for the current block.
     * Typically called once a transaction has been processed.
     *
     * @param transactionId A transaction ID
     */
    public async addTransactionId(transactionId: string): Promise<void> {
        if (this.currentBlock) {
            this.blocks[this.currentBlock].add(transactionId);
        }
    }

    /**
     * Get the current block number, or `undefined` if there is no previously saved state.
     *
     * @returns A block number
     */
    public async getBlockNumber(): Promise<Long|undefined> {
        return this.currentBlock ?
            Long.fromInt(this.currentBlock) : undefined;
    }

    /**
     * Get the transaction IDs processed within the current block.
     *
     * @returns Transaction IDs
     */
    public async getTransactionIds(): Promise<Set<string>> {
         return this.blocks[this.currentBlock ? this.currentBlock : 0];
     }

    /**
     * Set the current block number. Also clear the stored transaction IDs.
     * Typically set when the previous block has been processed.
     */
    public async setBlockNumber(blockNumber: Long): Promise<void> {
        if (!this.cachePreviousBlocks && this.currentBlock) {
            this.blocks[this.currentBlock].clear();
            delete this.blocks[this.currentBlock];
        }

        this.currentBlock = blockNumber.toInt();
        this.blocks[this.currentBlock] = new Set<string>();
    }
}
