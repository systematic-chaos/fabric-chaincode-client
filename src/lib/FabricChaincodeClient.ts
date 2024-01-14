'use strict';

import {IEnrollResponse} from 'fabric-ca-client';
import * as FabricCAService from 'fabric-ca-client';
import {ICryptoKey, ICryptoSuite, TransientMap} from 'fabric-client';
import * as FabricClient from 'fabric-client';
import {Contract, FileSystemWallet, Gateway, GatewayOptions, Network, X509WalletMixin} from 'fabric-network';
import {readFileSync} from 'fs';
// @ts-ignore
import * as jsrsasign from 'jsrsasign';
import {IConfigOptions} from '../typings/ConfigOptions';

/**
 * Implementation of a client that allows the querying and invoking of chaincode directly, abstracting from the process
 * the creation of the wallet, the enrollment, the obtainment and storage of the cryptographic data, the control of the
 * gateway among other things.
 *
 * @class
 */
export class FabricChaincodeClient {
    private readonly cryptoSuiteStorePath: string = '/tmp/fabric-chaincode-client/hfc-key-store/';
    private readonly distinguishedNameAttributes: string;
    private readonly stateStorePath: string = '/tmp/fabric-chaincode-client/hfc-key-store/';
    private readonly walletPath: string = '/tmp/fabric-chaincode-client/wallet/';

    private fabricCaClient: FabricCAService;
    private fabricClient: FabricClient;

    /**
     * @param config {IConfigOptions} - Specific configuration related to the user and the CA. This configuration is
     * used to enroll the user that is going to query/invoke the chaincode.
     * @param network {FabricClient | string | object} - Network configuration in the standard Hyperledger Fabric
     * format. See the docs of `fabric-client` or `fabric-network` for more information about this.
     * @param distinguishedNameAttributes {string} - Optional distinguished name attributes in string format to be used
     * in the Certificate Signing Request. By default `,C=SE,ST=Västerås,O=Katet-Corp` is used.
     */
    constructor(
        protected config: IConfigOptions,
        protected network: FabricClient | string | object,
        distinguishedNameAttributes?: string
    ) {
        const caServiceAuth = this.config.ca.enrollmentId + ':' + this.config.ca.enrollmentSecret;
        const caServiceHost = this.config.ca.host + ':' + this.config.ca.port;
        const caServiceUrl = 'https://' + caServiceAuth + '@' + caServiceHost;

        this.fabricClient = new FabricClient();
        this.fabricCaClient = new FabricCAService(
            caServiceUrl,
            undefined,
            this.config.ca.host,
            this.fabricClient.getCryptoSuite());

        if (distinguishedNameAttributes) {
            this.distinguishedNameAttributes = distinguishedNameAttributes;
        } else {
            this.distinguishedNameAttributes = ',C=SE,ST=Västerås,O=Katet-Corp';
        }
    }

    /**
     * Check if one given user is enrolled by checking if its cryptographic data is stored locally.
     *
     * @param userContext {FabricClient.User} - Context of the user that is going to be checked
     *
     * @return {boolean} - `true` if the user is enrolled, `false` otherwise.
     */
    private static isUserStoredLocally(userContext: FabricClient.User): boolean {
        return userContext && userContext.isEnrolled();
    }

    /**
     * Given a query/invoke response, parses it and returns 200 OK if it is empty.
     *
     * @param {Buffer} response - query/invoke response.
     *
     * @return {string} - The parsed response.
     */
    private static parseResponse(response: Buffer): string {
        const parsedResponse: string = response.toString();

        if (parsedResponse === '') {
            return '200 OK';
        }

        return parsedResponse;
    }

    /**
     * Given a user, returns its certificate.
     *
     * This patch is required because FabricClient.User does not has a .getCertificate() method.
     *
     * @param user {FabricClient.User} - The user whose certificate is going to be extracted.
     *
     * @return {string} - The parsed response.
     */
    private static getUserCertificate(user: FabricClient.User): string {
        return JSON.parse(user.toString()).enrollment.identity.certificate;
    }

    /**
     * Given a user, returns its signing identity.
     *
     * This patch is required because FabricClient.User has a .getSigningIdentity() but it returns an object which does
     * not represent the enrollment signing identity. This should be replaced by .getEnrollment().getSigningIdentity()
     * in case it exists in future versions.
     *
     * @param user {FabricClient.User} - The user whose certificate is going to be extracted.
     *
     * @return {string} - The parsed response.
     */
    private static getUserEnrollmentSigningIdentity(user: FabricClient.User): string {
        return JSON.parse(user.toString()).enrollment.signingIdentity;
    }

    /**
     * Creates the state store and assigns it to the fabricClient.
     *
     * The state store is a key value store where users certificates are kept. It iss created in the path
     * this.stateStorePath.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @return {Promise<void>}
     */
    private async createStateStore(): Promise<void> {
        const stateStore = await FabricClient.newDefaultKeyValueStore({
            path: this.stateStorePath
        });

        this.fabricClient.setStateStore(stateStore);
    }

    /**
     * Creates the crypto suite and assigns it to the fabricClient.
     *
     * The crypto suite depends on the crypto store, which is a value store where users keys are kept. It is also
     * created in the path this.cryptoSuiteStorePath.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @return {Promise<void>}
     */
    private async createCryptoSuite(): Promise<void> {
        const cryptoStore = FabricClient.newCryptoKeyStore({
            path: this.cryptoSuiteStorePath
        });

        const cryptoSuite: ICryptoSuite = FabricClient.newCryptoSuite();
        cryptoSuite.setCryptoKeyStore(cryptoStore);

        this.fabricClient.setCryptoSuite(cryptoSuite);
    }

    /**
     * Gets user context by calling the CA.
     *
     * User context is used to identify the user in the server, which is lately used to know if is already enrolled and
     * has its cryptographic data stored locally.
     *
     * @return {Promise<FabricClient.User>} - The user context.
     */
    private async getUserContext(): Promise<FabricClient.User> {
        return this.fabricClient.getUserContext(this.config.userName, true);
    }

    /**
     * Generate a PEM-encoded PKCS#10 Certificate Signing Request using an ephemeral private key.
     *
     * A CSR is the message sent from client side to the CA for the digital identity certificate.
     *
     * @param {ICryptoKey} privateKey - Private key used to generate the CSR.
     *
     * @return {Promise<string>} - The PEM-encoded CSR.
     */
    private async generateCertificateSigningRequest(privateKey: ICryptoKey): Promise<string> {
        const subjectDistinguishedName: string = 'CN=' + this.config.ca.enrollmentId + this.distinguishedNameAttributes;
        const asn1 = jsrsasign.asn1;

        return asn1.csr.CSRUtil.newCSRPEM({
            sbjprvkey: privateKey.toBytes(),
            sbjpubkey: privateKey.getPublicKey().toBytes(),
            sigalg: 'SHA256withECDSA',
            subject: {str: asn1.x509.X500Name.ldapToOneline(subjectDistinguishedName)},
        });
    }

    /**
     * Obtains user cryptographic configuration by enrolling it to the CA.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @return {Promise<FabricClient.User>} - The enrolled user context.
     */
    private async enrollUser(): Promise<FabricClient.User> {
        const privateKey: ICryptoKey = await this.fabricClient.getCryptoSuite().generateKey({ephemeral: true});
        const csr: string = await this.generateCertificateSigningRequest(privateKey);

        const enrollResponse: IEnrollResponse = await this.fabricCaClient.enroll({
            csr,
            enrollmentID: this.config.ca.enrollmentId,
            enrollmentSecret: this.config.ca.enrollmentSecret
        });

        const user: FabricClient.User = await this.fabricClient.createUser({
            cryptoContent: {
                privateKeyPEM: privateKey.toBytes(),
                signedCertPEM: enrollResponse.certificate
            },
            mspid: this.config.userOrg,
            skipPersistence: false,
            username: this.config.userName
        });

        await this.fabricClient.setUserContext(user);

        return user;
    }

    /**
     * Obtains user cryptographic configuration and returns it.
     *
     * The user is enrolled in case it is not stored locally.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @return {Promise<FabricClient.User>} - The enrolled user context.
     */
    private async getUser(): Promise<FabricClient.User> {
        await this.createStateStore();
        await this.createCryptoSuite();

        const userContext: FabricClient.User = await this.getUserContext();

        let user: FabricClient.User;
        if (FabricChaincodeClient.isUserStoredLocally(userContext)) {
            user = userContext;
        } else {
            user = await this.enrollUser();
        }

        return user;
    }

    /**
     * Prepares a wallet with the user crypto config. This allows the execution of queries and invokes as if them where
     * executed by the user defined in the configuration.
     *
     * The user is enrolled in case it is not stored locally.
     *
     * This operation is idempotent, so executing it multiple times in a row results in no unexpected behaviours.
     *
     * @return {Promise<void>}
     */
    protected async prepareWallet(): Promise<void> {
        const wallet = new FileSystemWallet(this.walletPath);
        const user = await this.getUser();

        const identityLabel = user.getName();
        const cert: string = FabricChaincodeClient.getUserCertificate(user);
        const key = readFileSync(
            this.cryptoSuiteStorePath + FabricChaincodeClient.getUserEnrollmentSigningIdentity(user) + '-priv'
        ).toString();

        await wallet.import(identityLabel, X509WalletMixin.createIdentity(this.config.adminIdentity, cert, key));
    }

    /**
     * Connects a gateway to the Fabric network.
     * 
     * @param gateway {Gateway} - Gateway object to be connected to the network.
     *                              If it is not provided, a new gateway will be instantiated.
     * @return {Promise<Gateway>} - The gateway connected to the Fabric network.
     */
    protected async connectGateway(gateway?: Gateway): Promise<Gateway> {
        if (typeof gateway === 'undefined') {
            gateway = new Gateway();
        }

        const connectionProfile: FabricClient | string | object = this.network;
        const connectionOptions: GatewayOptions = {
            discovery: {
                enabled: true,
                asLocalhost: false
            },
            identity: this.config.userName,
            wallet: new FileSystemWallet(this.walletPath)
        };

        await gateway.connect(connectionProfile, connectionOptions);
        return gateway;
    }

    /**
     * Given a gateway, a channel and a smart contract name, returns the associated contract object.
     *
     * @param {Gateway} gateway - Gateway connection.
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     *
     * @return {Promise<Contract>} - The contract object.
     */
    private async getContract(gateway: Gateway, channel: string, smartContract: string): Promise<Contract> {
        await this.connectGateway(gateway);
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
     * @param {string} transaction - Transaction name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async queryInternal(channel: string, smartContract: string, transaction: string,
                                ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway, channel, smartContract);
            const response: Buffer = (await contract.evaluateTransaction(transaction, ...args));

            return FabricChaincodeClient.parseResponse(response);
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
     * @param {string} transaction - Transaction name.
     * @param {TransientMap} privateData - Object with String property names and Buffer property values.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async querySecretInternal(channel: string, smartContract: string, transaction: string,
                                      privateData: TransientMap, ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway, channel, smartContract);
            const response: Buffer = await contract.createTransaction(transaction)
                .setTransient(privateData).submit(...args);

            return FabricChaincodeClient.parseResponse(response);
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
     * @param {string} transaction - Transaction name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    private async invokeInternal(channel: string, smartContract: string, transaction: string,
                                 ...args: string[]): Promise<string> {
        const gateway: Gateway = new Gateway();

        try {
            const contract: Contract = await this.getContract(gateway, channel, smartContract);
            const response: Buffer = await contract.submitTransaction(transaction, ...args);

            return FabricChaincodeClient.parseResponse(response);
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
     * @param {string} transaction - Transaction name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async query(channel: string, smartContract: string, transaction: string,
                       ...args: string[]): Promise<string> {
        await this.prepareWallet();
        return await this.queryInternal(channel, smartContract, transaction, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeds to query a chaincode.
     *
     * The query itself is a wrapper for the querySecretInternal function. Arguments are forwarded.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} transaction - Transaction name.
     * @param {TransientMap} privateData - Object with String property names and Buffer property values.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async querySecret(channel: string, smartContract: string, transaction: string, privateData: TransientMap,
                             ...args: string[]): Promise<string> {
        await this.prepareWallet();
        return await this.querySecretInternal(channel, smartContract, transaction, privateData, ...args);
    }

    /**
     * Creates a wallet if it does not exist and proceeds to invoke a chaincode.
     *
     * The invoke itself is a wrapper for the invokeInternal function. Arguments are forwarded.
     *
     * @param {string} channel - Name to identify the channel.
     * @param {string} smartContract - Smart contract name.
     * @param {string} transaction - Transaction name.
     * @param {string[]} args - Transaction function arguments.
     *
     * @return {Promise<string>} - Response or 200 OK if response is empty.
     */
    public async invoke(channel: string, smartContract: string, transaction: string,
                        ...args: string[]): Promise<string> {
        await this.prepareWallet();
        return await this.invokeInternal(channel, smartContract, transaction, ...args);
    }
}
