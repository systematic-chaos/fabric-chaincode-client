import { Wallet, Wallets } from 'fabric-network';
import * as fabproto6 from 'fabric-protos';
import * as fs from 'fs';

/**
 * Build an in memory object with the network configuration
 * (also known as a connection profile).
 * 
 * @param ccpPath Connection configuration file path
 * @returns Object containing the connection profile
 */
const buildConnectionProfile = (ccpPath: string): Record<string, any> => {
    // Load the connection configuration file
    const fileExists = fs.existsSync(ccpPath);
    if (!fileExists) {
        throw new Error(`No such file or directory: ${ccpPath}`);
    }
    const contents = fs.readFileSync(ccpPath, 'utf8');

    // Build a JSON object from the file contents
    const ccp = JSON.parse(contents);

    console.log(`Loaded the network configuration located at ${ccpPath}`);
    return ccp;
};

/**
 * Create a new wallet.
 * Note that wallet is for managing identities.
 * 
 * @param walletPath
 * @returns Wallet
 */
const createWallet = async (walletPath: string): Promise<Wallet> => {
    let wallet: Wallet;
    if (walletPath) {
        wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Built/Retrieved a file system wallet at ${walletPath}`);
    } else {
        wallet = await Wallets.newInMemoryWallet();
        console.log('Built an in memory wallet');
    }
    return wallet;
};

/**
 * Given a query/invoke response, parses it and returns 200 OK if it is empty.
 *
 * @param {Buffer} response - query/invoke response.
 *
 * @return {string} - The parsed response.
 */
const parseResponse = (response: Buffer): string => {
    const parsedResponse: string = response.toString();

    if (parsedResponse === '') {
        return '200 OK';
    }

    return parsedResponse;
}


// @ts-ignore
const showTransactionData = (transactionData: fabproto6.protos.ITransaction,
        verboseLevel: number = 1): void => {
    // @ts-ignore
    const creator = transactionData.actions[0].header.creator;
    console.log(`   - submitted by: ${creator.mspid}-${creator.id_bytes.toString('hex')}`);
    // @ts-ignore
    for (const endorsement of transactionData.actions[0].payload.action.endorsements) {
        console.log(`   - endorsed by: ${endorsement.endorser.mspid}-${endorsement.endorser.id_bytes.toString('hex')}`);
    }
    // @ts-ignore
    const chaincode = transactionData.actions[0].payload.chaincode_proposal_payload.input.chaincode_spec;
    console.log(`   - chaincode: ${chaincode.chaincode_id.name}`);
    console.log(`   - function: ${chaincode.input.args[0].toString()}`);
    for (let x = 1; x < chaincode.input.args.length; x++) {
        console.log(`   - arg: ${chaincode.input.args[x].toString()}`);
    }

    if (verboseLevel > 2) {
        console.log(beautifyTransactionData(transactionData))
    } else if (verboseLevel > 1 && transactionData.actions) {
        console.log(beautifyTransactionData(transactionData.actions[0]));
    }
}

const beautifyTransactionData = (input: object | string): string => {
    let inputObject = typeof input === 'string' ? JSON.parse(input) : input;
    return JSON.stringify(inputObject, null, 2);
}

export {
    buildConnectionProfile,
    createWallet,
    parseResponse,
    showTransactionData,
};

export type ITransaction = fabproto6.protos.ITransaction;
