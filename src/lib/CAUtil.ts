import { Wallet } from 'fabric-network';
import { IX509Identity } from '../../typings/types'
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
const enrollAdmin = async (caClient: FabricCAServices, wallet: Wallet, orgMspId: string,
        adminUserId: string, adminUserPasswd: string): Promise<void> => {
    try {
        // Check to see if we've already enrolled the admin user
        const identity = await wallet.get(adminUserId);
        if (identity) {
            console.log('An identity for the admin user already exists in the wallet.');
            return;
        }

        const enrollment = await caClient.enroll({ enrollmentID: adminUserId,
                                                    enrollmentSecret: adminUserPasswd });
        const x509Identity = buildIdentity(
            enrollment.certificate, enrollment.key.toBytes(), orgMspId);
        await wallet.put(adminUserId, x509Identity);
        console.log(`Successfully enrolled admin user ${adminUserId} and imported it into the wallet`);
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
const registerAndEnrollUser = async (caClient: FabricCAServices, wallet: Wallet, orgMspId: string,
        userId: string, adminUserId: string, userAffiliation?: string): Promise<void> => {
    if (!userAffiliation) {
        userAffiliation = caClient.getCaName();
    }

    try {
        // Check to see if we've already enrolled the user
        const userIdentity = await wallet.get(userId);
        if (userIdentity) {
            console.log(`An identity for the user ${userId} already exists in the wallet`);
            return;
        }

        // Must use an admin to register a new user
        const adminIdentity = await wallet.get(adminUserId);
        if (!adminIdentity) {
            console.log(`An identity for the admin user ${adminUserId} does not exist in the wallet`);
            console.log('Enroll the admin user before retrying');
            return;
        }

        // Build an user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, adminUserId);

        // Register and enroll the user
        const secret = await caClient.register({
            affiliation: userAffiliation,
            enrollmentID: userId,
            role: 'client'
        }, adminUser);
        const enrollment = await caClient.enroll({
            enrollmentID: userId,
            enrollmentSecret: secret
        });
        const x509Identity = buildIdentity(
            enrollment.certificate, enrollment.key.toBytes(), orgMspId);
        await wallet.put(userId, x509Identity);
        console.log(`Successfully registered and enrolled user ${userId} and imported it into the wallet`);
    } catch (error) {
        console.error(`Failed to register user : ${error}`);
    }
};

const buildIdentity = (cert: string, pemKey: string, mspID: string): IX509Identity => {
    return {
        credentials: {
            certificate: cert,
            privateKey: pemKey
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
