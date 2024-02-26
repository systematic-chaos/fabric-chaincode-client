'use strict';

import { Client as FabricClient } from 'fabric-common';
import { BlockListener, ContractListener, Gateway, ListenerOptions } from 'fabric-network';

import { FabricChaincodeClient } from './FabricChaincodeClient';
import { ConfigOptions } from '../typings/types';

/**
 * @class
 * 
 * Implementation of a client that allows the querying and invoking of chaincode directly, as well
 * as the register and subscription to events emitted from the network. All of this is performed
 * while providing an abstraction to the process from the creation of the wallet, the user
 * enrollment, the obtainment and storage of cryptographic data and the control of the gateway
 * among other things.
 */
export class FabricEventClient extends FabricChaincodeClient {

    private stickyGateway: Gateway | null = null;
    private ccEventHub: {[key/*channel*/: string]: {[key/*contract*/: string]: Array<ContractListener>}} = {};
    private blockEventHub: {[key/*channel*/: string]: Array<BlockListener>} = {};

    constructor(
        config: ConfigOptions,
        network: FabricClient | string | object,
        walletPath: string) {
            super(config, network, walletPath);
    }

    /**
     * Subscribe to chaincode events from a contract in a channel.
     * 
     * @param channel
     * @param chaincodeName
     * @param eventName
     * @param callback
     * @param startBlock
     */
    public async subscribeToChaincodeEvents(channel: string, chaincodeName: string,
            callback: ContractListener, startBlock?: number): Promise<void> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        if (!this.ccEventHub.hasOwnProperty(channel)) {
            this.ccEventHub[channel] = {};
        }
        if (!this.ccEventHub[channel].hasOwnProperty(chaincodeName)) {
            this.ccEventHub[channel][chaincodeName] = [];
        }

        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway(this.stickyGateway, false);
        }

        let listenerOptions: ListenerOptions = {
            type: EventType.FULL
        };
        if (startBlock) {
            listenerOptions.startBlock = startBlock;
        }

        let network = await this.stickyGateway.getNetwork(channel);
        let contract = network.getContract(chaincodeName);
        await contract.addContractListener(callback, listenerOptions);

        this.ccEventHub[channel][chaincodeName].push(callback);
    }

    /**
     * Makes all contract event listeners installed for the channel and chaincode specified
     * to start replaying events starting on the block identified by startBlock.
     * This method actually removes the existing contract event listeners installed on the
     * contract (in the channel's context) and reinstalls them by setting the startBlock option.
     * BlockListener instances are preserved, since they are just callback functions.
     *
     * @param channel
     * @param chaincodeName
     * @param startBlock
     */
    public async replayChaincodeEvents(channel: string, chaincodeName: string,
            startBlock: number): Promise<void> {
        if (!!this.stickyGateway
                && channel in this.ccEventHub && chaincodeName in this.ccEventHub[channel]) {
            let network = await this.stickyGateway.getNetwork(channel);
            let contract = network.getContract(chaincodeName);

            let listenerOptions: ListenerOptions = {
                startBlock: startBlock,
                type: EventType.FULL
            };
            
            this.ccEventHub[channel][chaincodeName].forEach((ccl) => {
                contract.removeContractListener(ccl);
                contract.addContractListener(ccl, listenerOptions);
            });
        }
    }

    /**
     * Subscribe to block events from a channel.
     * 
     * @param channel
     * @param callback
     * @param startBlock
     * @param privateEvents
     */
    public async subscribeToBlockEvents(channel: string, callback: BlockListener,
            startBlock?: number, privateEvents: boolean = false): Promise<void> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        if (!this.blockEventHub.hasOwnProperty(channel)) {
            this.blockEventHub[channel] = [];
        }

        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway(this.stickyGateway, false);
        }

        let listenerOptions: ListenerOptions = {
            type: privateEvents ? EventType.PRIVATE : EventType.FULL
        };
        if (startBlock) {
            listenerOptions.startBlock = startBlock;
        }

        let network = await this.stickyGateway.getNetwork(channel);
        await network.addBlockListener(callback, listenerOptions);

        this.blockEventHub[channel].push(callback);
    }

    /**
     * Makes all block event listeners installed for the channel specified
     * to start replaying events starting on the block identified by startBlock.
     * This method actually removes the existing block event listeners installed
     * on the channel and reinstalls them by setting the startBlock option.
     * BlockListener instances are preserved, since they are just callback functions.
     *
     * @param channel
     * @param startBlock
     * @param privateEvents
     */
    public async replayBlockEvents(channel: string,
            startBlock: number, privateEvents: boolean = false): Promise<void> {
        if (!!this.stickyGateway && channel in this.blockEventHub) {
            let network = await this.stickyGateway.getNetwork(channel);
            
            let listenerOptions: ListenerOptions = {
                startBlock: startBlock,
                type: privateEvents ? EventType.PRIVATE : EventType.FULL
            };

            this.blockEventHub[channel].forEach(async (bl) => {
                network.removeBlockListener(bl);
                await network.addBlockListener(bl, listenerOptions);
            });
        }
    }

    /**
     * Disconnect from a channel's event hub, also unregistering any event handlers.
     * @param channel Channel onto which stop receiving blocks.
     *                  If not provided, every channel event hub is disconnected.
     * @param removeFromChannel Whether the channel description should be completely removed
     *                          from the state of this `FabricChaincodeEventClient` object
     *                          or should be kept for later reusing.
     */
    private async disconnectEventHub(channel?: string, removeFromChannel: boolean = true): Promise<void> {
        if (!this.stickyGateway) {
            return;
        }

        let channels = !!channel ? [channel] : Object.getOwnPropertyNames(this.ccEventHub);
        for (let c of channels) {
            let network = await this.stickyGateway.getNetwork(c);
            if (c in this.ccEventHub) {
                for (let cc in this.ccEventHub[c]) {
                    let contract = network.getContract(cc);
                    for (let ccl of this.ccEventHub[c][cc]) {
                        contract.removeContractListener(ccl);
                    }
                }
                
                if (removeFromChannel) {
                    delete this.ccEventHub[c];
                }
            }
            
            if (c in this.blockEventHub && !!this.stickyGateway) {
                let beh = this.blockEventHub[c];

                for (let be of beh) {
                    network.removeBlockListener(be);
                }

                if (removeFromChannel) {
                    delete this.blockEventHub[c];
                }
            }
        }
    }

    /**
     * Disconnect the client from the network, unregistering any event handlers from the
     * channels' event hubs and subsequently disconnecting the gateway.
     */
    public async disconnect() {
        await this.disconnectEventHub();

        if (!!this.stickyGateway) {
            this.stickyGateway.disconnect();
            this.stickyGateway = null;
        }
    }
}

enum EventType {
    FILTERED = 'filtered',
    FULL = 'full',
    PRIVATE = 'private'
}
