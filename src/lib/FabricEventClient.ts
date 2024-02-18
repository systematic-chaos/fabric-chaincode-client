'use strict';

import { Client as FabricClient } from 'fabric-common';
import { BlockListener, Contract, ContractListener, Gateway } from 'fabric-network';

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
    private ccEventHub: {[channel: string]: Array<{ contract: Contract, listener?: ContractListener }>} = {};
    private blockEventHub: {[channel: string]: Array<BlockListener>} = {};

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
     */
    public async subscribeToChaincodeEvents(channel: string, chaincodeName: string,
            callback: ContractListener) {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        if (!this.ccEventHub.hasOwnProperty(channel)) {
            this.ccEventHub[channel] = [];
        }

        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway(undefined, false);
        }

        let network = await this.stickyGateway.getNetwork(channel);
        let contract = network.getContract(chaincodeName);
        let listener = await contract.addContractListener(callback);

        this.ccEventHub[channel].push({ contract, listener });
    }

    /**
     * Subscribe to block events from a channel.
     * 
     * @param channel 
     * @param callback 
     */
    public async subscribeToBlockEvents(channel: string, callback: BlockListener,
            privateEvents: boolean = false) {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        if (!this.blockEventHub.hasOwnProperty(channel)) {
            this.blockEventHub[channel] = [];
        }

        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway(undefined, false);
        }

        let network = await this.stickyGateway.getNetwork(channel);
        let listener = await network.addBlockListener(callback,
            { type: privateEvents ? 'private' : 'full' });

        this.blockEventHub[channel].push(listener);
    }

    /**
     * Disconnect from a channel's event hub, also unregistering any event handlers.
     * @param channel Channel onto which stop receiving blocks.
     *                  If not provided, every channel event hub is disconnected.
     * @param removeFromChannel Whether the channel description should be completely removed
     *                          from the state of this `FabricChaincodeEventClient` object
     *                          or should be kept for later reusing.
     */
    private async disconnectEventHub(channel?: string, removeFromChannel: boolean = true) {
        let channels = !!channel ? [channel] : Object.getOwnPropertyNames(this.ccEventHub);
        for (let c of channels) {
            if (c in this.ccEventHub) {
                let cceh = this.ccEventHub[c];
                
                for (let ce of cceh) {
                    if (!!ce.listener) {
                        ce.contract.removeContractListener(ce.listener);
                    }
                }
                
                if (removeFromChannel) {
                    delete this.ccEventHub[c];
                }
            }
            
            if (c in this.blockEventHub && !!this.stickyGateway) {
                let network = await this.stickyGateway.getNetwork(c);
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
