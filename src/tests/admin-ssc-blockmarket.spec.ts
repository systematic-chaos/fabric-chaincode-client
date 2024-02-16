import { FabricChaincodeClient } from '..';

import { resolve as resolvePath } from 'path';

import { expect } from 'chai';
import 'mocha';

const clientConfig = {
    userName: 'admin',
    userOrg: 'ssc',
    adminIdentity : 'sscMSP',
    ca: {
        host: 'ica.ssc',
        port: '7054',
        enrollmentId: 'jntIazdt68r8Uxl6',
        enrollmentSecret: '0gDzEShIRsNBI2Fv'
    }
};

const networkConfig = {
    name: 'fabric',
    'x-type': 'hlfv2',
    description: 'Fabric Network',
    version: '2.4',
    channels: {
        retail: {
            peers: {
                'peer.ssc': {
                    endorsingPeer: true
                }
            }
        }
    },
    organizations: {
        ssc: {
            mspid: 'sscMSP',
            peers: [
                'peer0.ssc'
            ],
            certificateAuthorities: [
                'ica.ssc'
            ]
        }
    },
    peers: {
        'peer0.ssc': {
            url: 'grpcs://peer0.ssc:7051',
            eventUrl: 'grpcs://peer.ssc:7052',
            tlsCACerts: {
                path: '/shared-storage/ssc/ca-chain.pem'
            }
        }
    },
    certificateAuthorities: {
        'ica.ssc': {
            url: 'https://ica.ssc:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/ssc/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: 'XdQU7U8mCKMks9hg',
                    enrollSecret: 'GLTXeOLkasSY5FxF'
                }
            ],
            caName: 'ica.ssc'
        }
    }
};

describe('SSC without custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(
        clientConfig, networkConfig, resolvePath(process.cwd(), 'wallet'));

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });

    describe('invoke', () => {

        describe('#init', () => {

            let response: string;

            it('should invoke the chaincode', async () => {
                response = await fabricChaincodeClient.invoke('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});

describe('SSC with custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(clientConfig, networkConfig, 'C=SE,ST=Västerås,O=Katet-Corp');

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });

    describe('invoke', () => {

        describe('#init', () => {

            let response: string;

            it('should invoke the chaincode', async () => {
                response = await fabricChaincodeClient.invoke('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});
