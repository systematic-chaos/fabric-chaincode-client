import { Wallet, Wallets } from 'fabric-network';
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
        console.log(`Built a file system wallet at ${walletPath}`);
    } else {
        wallet = await Wallets.newInMemoryWallet();
        console.log('Built an in memory wallet');
    }
    return wallet;
};

export {
    buildConnectionProfile,
    createWallet
};
