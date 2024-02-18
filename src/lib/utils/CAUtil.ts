import { ICryptoKey } from 'fabric-common';
import { Wallet } from 'fabric-network';
import { ConfigOptions, X509Identity } from '../../typings/types'
import * as FabricCAServices from 'fabric-ca-client';

/**
 * Create a new CA client for interacting with the CA.
 * 
 * @param ccp Connection profile
 * @param caHostName Certification Authority host name
 * @returns Certification Authority client object
 */
const buildCAClient = (ccp: Record<string, any>, caHostName: string): FabricCAServices => {
    const caInfo = ccp.certificateAuthorities[caHostName];  // lookup CA details from config
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const caClient = new FabricCAServices(caInfo.url,
        { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);
    
    console.log(`Built a CA client named ${caInfo.caName}`);
    return caClient;
};

/**
 * Enroll the organization's admin user and import the new identity into the wallet.
 * In a production-ready application, this would be done on an administrative flow, and only once.
 */
const enrollAdmin = async (caClient: FabricCAServices, wallet: Wallet,
        confOpts: ConfigOptions, adminUserPasswd: string): Promise<void> => {
    try {
        // Check to see if we've already enrolled the admin user
        const identity = await wallet.get(confOpts.adminIdentity);
        if (identity) {
            console.log('An identity for the admin user already exists in the wallet.');
            return;
        }

        const enrollment = await caClient.enroll({ enrollmentID: confOpts.adminIdentity,
                                                    enrollmentSecret: adminUserPasswd });
        const x509Identity = buildIdentity(
            enrollment.certificate, enrollment.key.toBytes(), confOpts.userOrg);
        await wallet.put(confOpts.adminIdentity, x509Identity);
        console.log(`Successfully enrolled admin user ${confOpts.adminIdentity} and imported it into the wallet`);
    } catch (error) {
        console.error(`Failed to enroll admin user : ${error}`);
    }
};

/**
 * Register the user, enroll the user, and import the new identity into the wallet.
 * If affiliation is specified by client, the affiliation value must be configured by the CA.
 * 
 * In a production-ready application, this would be done only when a new user
 * was required to be added, and would be part of an administrative flow.
 */
const registerAndEnrollUser = async (caClient: FabricCAServices, wallet: Wallet,
    confOpts: ConfigOptions): Promise<void> => {
    if (!confOpts.affiliation) {
        confOpts.affiliation = caClient.getCaName();
    }

    try {
        // Check to see if we've already enrolled the user
        const userIdentity = await wallet.get(confOpts.userName);
        if (userIdentity) {
            console.log(`An identity for the user ${confOpts.userName} already exists in the wallet`);
            return;
        }

        // Must use an admin to register a new user
        const adminIdentity = await wallet.get(confOpts.adminIdentity);
        if (!adminIdentity) {
            console.error(`An identity for the admin user ${confOpts.adminIdentity} does not exist in the wallet`);
            console.error('Enroll the admin user before retrying');
            return;
        }

        // Build an user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, confOpts.adminIdentity);

        // Register and enroll the user
        // This operation will fail if the user is already registered
        // In such a case, we retrieve the enrollment data and store a new identity into the wallet
        var enrollment;
        try {
            const secret = await caClient.register({
                affiliation: confOpts.affiliation,
                enrollmentID: confOpts.userName,
                role: 'client'
            }, adminUser);
            console.log(`User ${confOpts.userName} successfully registered`);
        
            enrollment = await caClient.enroll({
                enrollmentID: confOpts.userName,
                enrollmentSecret: secret
            });
            console.log(`User ${confOpts.userName} successfully enrolled`);
        } catch (error) {
            console.log(`The user ${confOpts.userName} may already be registered`);
            enrollment = {
                certificate: confOpts.ca.enrollmentId,
                key: confOpts.ca.enrollmentSecret
            };
        }

        const x509Identity = buildIdentity(
            enrollment.certificate, enrollment.key, confOpts.userOrg);
        await wallet.put(confOpts.userName, x509Identity);
        console.log(`User ${confOpts.userName}'s credentials were imported into the wallet`);
    } catch (error) {
        console.error(`Failed to register user : ${error}`);
    }
};

const buildIdentity = (cert: string, pemKey: ICryptoKey | string, mspID: string): X509Identity => {
    return {
        credentials: {
            certificate: cert,
            privateKey: typeof pemKey === 'string' ? pemKey : pemKey.toBytes()
        },
        mspId: mspID,
        type: 'X.509'
    }
};

export {
    buildCAClient,
    buildIdentity,
    enrollAdmin,
    registerAndEnrollUser
};
