'use strict';

import { Client as FabricClient, User } from 'fabric-common';
import { Contract, Gateway, GatewayOptions, Network, TransientMap, Wallet } from 'fabric-network';

import { buildCAClient, registerAndEnrollUser } from './utils/CAUtil';
import { createWallet, buildConnectionProfile, parseResponse } from './utils/ClientUtil';
import { ConfigOptions } from '../typings/types';

import * as FabricCAService from 'fabric-ca-client';
import * as EventStrategies from 'fabric-network/lib/impl/event/defaulteventhandlerstrategies';

/**
 * Implementation of a client that allows the querying and invoking of chaincode directly, abstracting from the process
 * the creation of the wallet, the enrollment, the obtainment and storage of the cryptographic data, the control of the
 * gateway among other things.
 *
 * @class
 */
export class FabricChaincodeClient {

    private fabricCaClient: FabricCAService;
    protected wallet: Wallet | undefined;
    protected connectionProfile: FabricClient | Record<string, unknown>;

    /**
     * @param config {IConfigOptions} - Specific configuration related to the user and the CA. This configuration is
     * used to enroll the user that is going to query/invoke the chaincode.
     * @param network {FabricClient | string | object} - Network configuration in the standard Hyperledger Fabric
     * format. See the docs of `fabric-client` or `fabric-network` for more information about this.
     * Also, the path to a JSON file containing the connection profile can be provided.
     */
    constructor(
        protected config: ConfigOptions,
        network: FabricClient | string | object,
        private readonly walletPath: string) {
        this.connectionProfile = typeof network === 'string' ?
            buildConnectionProfile(network) : network as FabricClient;
        this.fabricCaClient = buildCAClient(this.connectionProfile, this.config.ca.host);
    }

    /**
     * Prepares a wallet with the user crypto config. This allows the execution of queries and invokes as if them where
     * executed by the user defined in the configuration.
     *
     * The user is enrolled in case it is not stored locally.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @returns {Promise<void>}
     */
    protected async prepareWallet(): Promise<void> {
        this.wallet = await createWallet(this.walletPath);

        const user = await this.getUserContext(this.wallet);
        if (!user || !user.isEnrolled()) {
            registerAndEnrollUser(this.fabricCaClient, this.wallet, this.config);
        } else {
            console.log(`User ${this.config.userName} is already registered and enrolled`);
        }
    }

    /**
     * Connects a gateway to the Fabric network.
     * 
     * @param gateway {Gateway} - Gateway object to be connected to the network.
     *                              If it is not provided, a new gateway will be instantiated.
     * @param waitForCommit {boolean} - Whenever a transaction is submitted, whether wait for
     *                              a confirmation event from the peer before returning
     *                              (synchronous/asynchronous commit).
     * @returns {Promise<Gateway>} - The gateway connected to the Fabric network.
     */
    protected async connectGateway(gateway: Gateway|null, waitForCommit: boolean): Promise<Gateway> {
        if (gateway == null) {
            gateway = new Gateway();
        }

        const gatewayConnectionOptions: GatewayOptions = {
            wallet: this.wallet,
            identity: this.config.userName,
            discovery: {
                enabled: true,

                // asLocalhost is set to true when this gateway is using a Fabric network deployed locally
                asLocalhost: this.config.asLocalhost === true
            }
        };
        if (!waitForCommit) {
            gatewayConnectionOptions.eventHandlerOptions = { strategy: EventStrategies.NONE };
        }

        await gateway.connect(this.connectionProfile, gatewayConnectionOptions);
        return gateway;
    }

    /**
     * Gets user context by calling the wallet.
     *
     * User context is used to identify the user in the server, which is lately used to know if is already enrolled and
     * has its cryptographic data stored locally.
     *
     * @param {Wallet} wallet
     * @returns {Promise<User>} - The user context.
     */
    private async getUserContext(wallet: Wallet): Promise<User|null> {
        let user = null;
        const userIdentity = await wallet.get(this.config.userName);

        if (userIdentity) {
            const provider = wallet.getProviderRegistry().getProvider(userIdentity.type);
            user = await provider.getUserContext(userIdentity, this.config.userName);
        }
        return user;
    }

    /**
     * Given a gateway, a channel and a smart contract name, returns the associated contract object.
     *
     * @param {Gateway} gateway - Gateway connection.
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {boolean} waitForCommit - Synchronous/asynchronous commit.
     *
     * @returns {Promise<Contract>} - The contract object.
     */
    private async getContract(gateway: Gateway, channel: string, smartContract: string,
            waitForCommit = true): Promise<Contract> {
        await this.connectGateway(gateway, waitForCommit);
        const network: Network = await gateway.getNetwork(channel);
        return network.getContract(smartContract);
    }

    /**
     * Given a channel, a smart contract and a transaction, evaluates that transaction.
     *
     * Returns response or 200 OK if response is empty.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async queryInternal(channel: string, smartContract: string, method: string,
                                ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway, channel, smartContract);
            const response: Buffer = (await contract.evaluateTransaction(method, ...args));

            return parseResponse(response);
        } finally {
            gateway.disconnect();
        }
    }

    /**
     * Given a channel, a smart contract, a transaction and private data submits that transaction.
     *
     * Transient data will be passed to the transaction function but will not be stored on the ledger.
     *
     * Returns response or 200 OK if response is empty.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {TransientMap} privateData - Object with String property names and Buffer property values.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async querySecretInternal(channel: string, smartContract: string, method: string,
                                      privateData: TransientMap, ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway, channel, smartContract);
            const response: Buffer = await contract.createTransaction(method)
                .setTransient(privateData).submit(...args);

            return parseResponse(response);
        } finally {
            gateway.disconnect();
        }
    }

    /**
     * Given a channel, a smart contract and a transaction, submits that transaction.
     *
     * Returns response or 200 OK if response is empty.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {boolean} waitForCommit - Synchronous/asynchronous commit.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async invokeInternal(channel: string, smartContract: string, method: string,
                                 waitForCommit: boolean, ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway,
                channel, smartContract, waitForCommit);
            const response: Buffer = await contract.submitTransaction(method, ...args);

            return parseResponse(response);
        } finally {
            gateway.disconnect();
        }
    }

    /**
     * Creates a wallet if it does not exist and proceeds to query a chaincode.
     *
     * The query itself is a wrapper for the queryInternal function. Arguments are forwarded.
     *
     * @param {string} channel - Name to identify the channel.SS
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async query(channel: string, smartContract: string, method: string,
                       ...args: string[]): Promise<string> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        return this.queryInternal(channel, smartContract, method, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeds to query a chaincode.
     *
     * The query itself is a wrapper for the querySecretInternal function. Arguments are forwarded.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {TransientMap} privateData - Object with String property names and Buffer property values.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async querySecret(channel: string, smartContract: string, method: string, privateData: TransientMap,
                             ...args: string[]): Promise<string> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        return this.querySecretInternal(channel, smartContract, method, privateData, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeds to invoke a chaincode.
     * 
     * This method is equivalent to `invokeSync`, it is just kept for the sake of compatibility.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @returns {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async invoke(channel: string, smartContract: string, method: string,
                        ...args: string[]): Promise<string> {
        return this.invokeSync(channel, smartContract, method, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeds to invoke a chaincode synchronously.
     * 
     * The invokeSync itself is a wrapper for the invokeInternal function.
     * Arguments are forwarded, setting the `waitForCommit` parameter to true.
     * 
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {string[]} args - Transaction function arguments.
     * 
     * @returns {Promise<string>} - Response or 200 if response is empty.
     */
    public async invokeSync(channel: string, smartContract: string, method: string,
                            ...args: string[]): Promise<string> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        return this.invokeInternal(channel, smartContract, method, true, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeeds to invoke a chaincode asynchronously.
     * 
     * The invokeAsync itself is a wrapper for the invokeInternal function.
     * Arguments are forwarded, setting the `waitForCommit` parameter to true.
     * 
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} method - Method name.
     * @param {string[]} args - Transaction function arguments.
     * 
     * @returns {Promise<string>} - Response or 200 if response is empty.
     */
    public async invokeAsync(channel: string, smartContract: string, method: string,
                             ...args: string[]): Promise<string> {
        if (!this.wallet) {
            await this.prepareWallet();
        }

        return this.invokeInternal(channel, smartContract, method, false, ...args);
    }
}
