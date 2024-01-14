# Hyperledger Fabric Chaincode SDK for Node.js

Hyperledger Fabric is the operating system of an enterprise-strength permissioned blockchain network. For a high-level 
overview of the fabric, visit [http://hyperledger-fabric.readthedocs.io/en/latest/](http://hyperledger-fabric.readthedocs.io/en/latest/).

The Hyperledger Fabric Chaincode SDK for Node.js is an addition to the SDK already available for Node.js. Its finality
is to add a layer of abstraction to the developers, simplifying the process of interacting with the network by allowing
only these features:
    
* **Querying** a smart contract for the latest application state.
* **Submitting transactions** to a smart contract.
* Submitting transactions that include **private or sensitive data**.

## Installation

1. Look for the [latest release](https://github.com/systematic-chaos/fabric-chaincode-client/releases/tag/latest).
2. Install the latest release using the following format (replace X.Y.Z with the current release):

```bash
npm install https://github.com/systematic-chaos/fabric-chaincode-client.git#release-X.Y.Z
```

### Warning messages during installation

It is possible that during the installation you see a bunch of warnings related to `node-gyp`. These appear due to the 
usage done by the dependency `fabric-network`, so nothing can be done. They are not harmful and can be ignored.

## Usage

The SDK consists of one class called `FabricChaincodeClient` that has to be instantiated to be usable. That instantiation 
is used to pass the configuration of the network and the configuration related to the user that is going to be enrolled
and to the CA this user is going to enroll to. An optional string representing the distinguished name attributes can 
also be used.

Once instanced, only three methods are available: `query`, `querySecret` and `invoke`.

### API Reference

#### Constructor

```typescript
class FabricChaincodeClient {
    
    /**
     * @param config {IConfigOptions} - Specific configuration related to the user and the CA. This configuration is
     * used to enroll the user that is going to query/invoke the chaincode.
     * @param network {FabricClient | string | object} - Network configuration in the standard Hyperledger Fabric
     * format. See the docs of `fabric-client` or `fabric-network` for more information about this.
     * @param distinguishedNameAttributes {string} - Optional distinguished name attributes in string format to be used
     * in the Certificate Signing Request. By default `,C=US,ST=North Carolina,O=Hyperledger` is used.
     */
    constructor (
        config: IConfigOptions,
        network: FabricClient | string | object,
        distinguishedNameAttributes?: string
    ) { ... };
    
    ...

}
```

#### Available Methods

##### query

```typescript
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
        ...
    }
```

##### querySecret

```typescript
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
        ...
    }
```

##### invoke

```typescript
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
        ...
    }
```

### Configuration

As defined previously, the constructor of FabricChaincodeClient requires two JavaScript objects correspondent to the
configuration of the network and to the configuration related to the user that is going to be enrolled
and to the CA this user is going to enroll to. An optional string representing the distinguished name attributes can 
also be used.

Examples of different configurations used can be found inside of [src/tests/](src/tests/).

#### Network Configuration

Network configuration in the standard Hyperledger Fabric format. See the docs of `fabric-client` or `fabric-network` for 
more information about this. An example can be found 
[here](https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-network-config.html).

It is common to find examples in the literacy of this configuration written in YAML format. In this project, the JSON
format has been selected as it works better with native Node.js and involves less dependencies.

#### Enrollment Configuration

Specific configuration related to the user and the CA. This configuration is used to enroll the user that is going to 
query/invoke the chaincode.

Its definition can be found in [src/types/index.d.ts](src/types/index.d.ts).

#### Distinguished Name Attributes

Optional distinguished name attributes in string format to be used in the Certificate Signing Request. By default 
`,C=US,ST=North Carolina,O=Hyperledger` is used.

## Testing

It is not easy to have a generic way to test this library as it depends on the Hyperledger Network that it is targeting,
on its network setup and on which chaincode has installed. However, a test targeting the `retail` chaincode of the 
organization `retail` of the project `Blockmarket` has been included. Feel fry to modify it according to your projects
and requirements.

Note that the `retail` chaincode does not include any query involving private or sensitive data, which results in the 
method `querySecret` and its dependencies not being included in the coverage.

To execute the tests, run the following command:

```bash
npm run test
```

### Error messages during testing

Occasionally, it is possible that the test passes but leaves some errors or warnings printed. This is due to the nature of 
`fabric-network`, which prints logs by default of every warning and error during its execution. Usually, these errors
are not harmful, as the network is prepared to retry up to three times if there appear connection errors. However, if 
the errors persist and the tests do not pass, check your configuration files, are there could be some problems there.

If, due to the nature of your project, you must not allow this kind of logs, you can check the 
[logging overview](https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-logging.html) of the
Hyperledger Fabric SDK for Node.js docs as its comportment can be altered by setting environment variables. This can 
also be useful for logging.

**Example of an error message during testing**

```bash
  query
    #instantiate
      ✓ should query the chaincode (360ms)
      ✓ response should be `200 OK`

  invoke
    #instantiate
E0422 09:09:17.419662097   22649 ssl_transport_security.cc:1245] Handshake failed with fatal error SSL_ERROR_SSL: error:1416F086:SSL routines:tls_process_server_certificate:certificate verify failed.
E0422 09:09:18.420249909   22649 ssl_transport_security.cc:1245] Handshake failed with fatal error SSL_ERROR_SSL: error:1416F086:SSL routines:tls_process_server_certificate:certificate verify failed.
      ✓ should query the chaincode (2563ms)
      ✓ response should be `200 OK`


  4 passing (3s)
```

## Compatibility

The following tables show versions of Fabric, Node and other dependencies that are explicitly tested and that are 
supported for use with version 1.4 of the Hyperledger Fabric Chaincode SDK for Node.js

|              | Tested       | Supported      |
|--------------|--------------|----------------|
| **Fabric**   | 2.0          | 2.0.x, 2.2.x   |
| **Node**     | 12.22        | 10.13+, 12.13+ |
| **Platform** | Ubuntu 20.04 |                |
