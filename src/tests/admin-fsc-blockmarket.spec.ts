import { FabricChaincodeClient } from '..';

import { resolve as resolvePath } from 'path';

import { expect } from 'chai';
import 'mocha';

const clientConfig = {
    userName: 'admin',
    userOrg: 'fsc',
    adminIdentity : 'fscMSP',
    ca: {
        host: 'ica.fsc',
        port: '7054',
        enrollmentId: 'oOyq531Dk70kP31J',
        enrollmentSecret: 'v8ezZWwv1u8AX4nx'
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
                'peer.fsc': {
                    endorsingPeer: true
                }
            }
        }
    },
    organizations: {
        fsc: {
            mspid: 'fscMSP',
            peers: [
                'peer0.fsc'
            ],
            certificateAuthorities: [
                'ica.fsc'
            ]
        }
    },
    peers: {
        'peer0.fsc': {
            url: 'grpcs://peer0.fsc:7051',
            eventUrl: 'grpcs://peer.fsc:7052',
            tlsCACerts: {
                path: '/shared-storage/fsc/ca-chain.pem'
            }
        }
    },
    certificateAuthorities: {
        'ica.fsc': {
            url: 'https://ica.fsc:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/fsc/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: '9hivFmqzRKyLp2SM',
                    enrollSecret: 'ROEVgweD53q9CCXf'
                }
            ],
            caName: 'ica.fsc'
        }
    }
};

describe('FSC without custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(
        clientConfig, networkConfig, resolvePath(process.cwd(), 'wallet'));

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'fsc', 'init');
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
                response = await fabricChaincodeClient.invoke('retail', 'fsc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});

describe('FSC with custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(clientConfig, networkConfig, 'C=SE,ST=Västerås,O=Katet-Corp');

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'fsc', 'init');
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
                response = await fabricChaincodeClient.invoke('retail', 'fsc', 'init');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});
