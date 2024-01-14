'use strict';

import { FabricChaincodeClient } from './FabricChaincodeClient';

import { ChaincodeChannelEventHandle, ChaincodeEvent, Channel, ChannelEventHub } from 'fabric-client';
import * as FabricClient from 'fabric-client';
import { Gateway, Network } from 'fabric-network';
import { IConfigOptions } from '../typings/ConfigOptions';

/**
 * @class FabricChaincodeEventClient - Implementation of a client that allows the querying and
 * invoking of chaincode directly, as well as the register and subscription to events emitted from
 * the chaincode. All of this is performed while providing an abstraction to the process from the
 * creation of the wallet, the user enrollment, the obtainment and storage of cryptographic data,
 * and the control of the gateway among other things.
 */
export class FabricChaincodeEventClient extends FabricChaincodeClient {

    private stickyGateway: Gateway | null = null;
    private channelEventHub: {[key: string]: { hub: ChannelEventHub, handle?: ChaincodeChannelEventHandle }} = {};

    constructor(
        config: IConfigOptions,
        network: FabricClient | string | object,
        distinguishedNameAttributes?: string) {
            super(config, network, distinguishedNameAttributes);
    }

    public async subscribeToChaincodeEvent(channel: string, chaincodeId: string, eventName: string,
            callback: (event: ChaincodeEvent, blockNumber?: number, txId?: string, txStatus?: string) => void) {
        super.prepareWallet();

        if (!this.channelEventHub.hasOwnProperty(channel)) {
            try {
                this.channelEventHub[channel] = { 'hub': await this.connectToEventHub(channel) };
            } catch (err) {
                console.error(err);
                return;
            }
        }

        let ceh = this.channelEventHub[channel];
        ceh.handle = ceh.hub.registerChaincodeEvent(chaincodeId, eventName, callback,
            (error) => { console.error('Failed to receive the chaincode event: ' + error); },
            { disconnect: false, unregister: false });
    }

    /**
     * Connect to a channel's event hub.
     * @param channel {string} - channel onto which receive blocks.
     * @return {Promise<ChannelEventHub>} - Channel event hub, connected to the peer service.
     *                                      If a connection cannot be established, the promise
     *                                      will be rejected.
     */
    private async connectToEventHub(channel: string): Promise<ChannelEventHub> {
        if (!this.stickyGateway) {
            this.stickyGateway = await this.connectGateway();
        }

        let network: Network = await this.stickyGateway.getNetwork(channel);
        let networkChannel: Channel = network.getChannel();
        let hubs: ChannelEventHub[] = networkChannel.getChannelEventHubsForOrg(this.config.adminIdentity);

        return new Promise<ChannelEventHub>((resolve, reject) => {
            if (hubs.length > 0) {
                let hub = hubs[0];
                hub.connect({ full_block: true },
                    (err, _) => {
                        if (!err && hub.isconnected()) {
                            console.log('Connected to event hub');
                            resolve(hub);
                        } else {
                            reject('Failed to connect to event hub');
                        }
                    });
            } else {
                reject('No hubs were found');
            }
        });
    }

    /**
     * Disconnect from a channel's event hub, also unregistering any event handlers.
     * @param channel Channel onto which stop receiving blocks.
     * @param removeFromChannel Whether the channel description should be completely removed
     *                          from the state of this `FabricChaincodeEventClient` object
     *                          or should be kept for later reusing.
     */
    public disconnectEventHub(channel: string, removeFromChannel: boolean = true) {
        if (this.channelEventHub.hasOwnProperty(channel)) {
            let ceh = this.channelEventHub[channel];
            if (!!ceh.handle) {
                ceh.hub.unregisterChaincodeEvent(ceh.handle);
            }

            ceh.hub.disconnect();
            if (removeFromChannel) {
                delete this.channelEventHub[channel];
            }
        }
    }

    /**
     * Disconnect the client from the network, unregistering any event handlers from the
     * channels' event hubs and subsequently disconnecting the gateway.
     */
    public disconnect() {
        if (!!this.stickyGateway) {
            for (let channel in this.channelEventHub) {
                this.disconnectEventHub(channel);
            }
            this.stickyGateway.disconnect();
            this.stickyGateway = null;
        }
    }
}
