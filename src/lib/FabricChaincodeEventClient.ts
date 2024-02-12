'use strict';

import { FabricChaincodeClient } from './FabricChaincodeClient';

//import { ChaincodeChannelEventHandle, ChaincodeEvent, Channel, ChannelEventHub } from 'fabric-client';
import * as FabricClient from 'fabric-client';
import { Contract, ContractListener, Gateway } from 'fabric-network';
import { IConfigOptions } from '../typings/types';

/**
 * @class FabricChaincodeEventClient - Implementation of a client that allows the querying and
 * invoking of chaincode directly, as well as the register and subscription to events emitted from
 * the chaincode. All of this is performed while providing an abstraction to the process from the
 * creation of the wallet, the user enrollment, the obtainment and storage of cryptographic data,
 * and the control of the gateway among other things.
 */
export class FabricChaincodeEventClient extends FabricChaincodeClient {

    private stickyGateway: Gateway | null = null;
    private eventHub: {[channel: string]: Array<{ contract: Contract, listener?: ContractListener }>} = {};

    constructor(
        config: IConfigOptions,
        network: FabricClient | string | object,
        distinguishedNameAttributes?: string) {
            super(config, network, distinguishedNameAttributes);
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
        this.prepareWallet();

        if (!this.eventHub.hasOwnProperty(channel)) {
            this.eventHub[channel] = [];
        }

        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway();
        }

        let network = await this.stickyGateway.getNetwork(channel);
        let contract = network.getContract(chaincodeName);
        let listener = await contract.addContractListener(callback);

        this.eventHub[channel].push({ contract, listener });
    }

    /**
     * Disconnect from a channel's event hub, also unregistering any event handlers.
     * @param channel Channel onto which stop receiving blocks.
     *                  If not provided, every channel event hub is disconnected.
     * @param removeFromChannel Whether the channel description should be completely removed
     *                          from the state of this `FabricChaincodeEventClient` object
     *                          or should be kept for later reusing.
     */
    public disconnectEventHub(channel?: string, removeFromChannel: boolean = true) {
        let channels = !!channel ? [channel] : Object.getOwnPropertyNames(this.eventHub);
        for (let c of channels) {
            if (c in this.eventHub) {
                let cceh = this.eventHub[c];

                for (let ce of cceh) {
                    if (!!ce.listener) {
                        ce.contract.removeContractListener(ce.listener);
                    }
                }

                if (removeFromChannel) {
                    delete this.eventHub[c];
                }
            }
        }
    }

    /**
     * Disconnect the client from the network, unregistering any event handlers from the
     * channels' event hubs and subsequently disconnecting the gateway.
     */
    public disconnect() {
        this.disconnectEventHub();

        if (!!this.stickyGateway) {
            this.stickyGateway.disconnect();
            this.stickyGateway = null;
        }
    }
}
