import { FabricChaincodeClient } from '..';

import { resolve as resolvePath } from 'path';

import { expect } from 'chai';
import 'mocha';

const clientConfig = {
    userName: 'admin',
    userOrg: 'aimplas-notifier',
    adminIdentity : 'aimplas-notifierMSP',
    ca: {
        host: 'ica.aimplas-notifier',
        port: '7054',
        enrollmentId: 'HIA8Dksn3BJ6WReg',
        enrollmentSecret: 'KZjOhufv7iLlLrWI'
    }
};

const networkConfig = {
    name: 'fabric',
    'x-type': 'hlfv2',
    description: 'Fabric Network',
    version: '2.4',
    channels: {
        'veritas-channel': {
            peers: {
                'peer.aimplas-notifier': {
                    endorsingPeer: true
                },
                'peer.first-compounder': {
                    endorsingPeer: true
                },
                'peer.second-compounder': {
                    endorsingPeer: true
                },
                'peer.third-compounder': {
                    endorsingPeer: true
                },
            }
        }
    },
    organizations: {
        'aimplas-notifier': {
            mspid: 'aimplas-notifierMSP',
            peers: [
                'peer0.aimplas-notifier'
            ],
            certificateAuthorities: [
                'ica.aimplas-notifier'
            ]
        },
        'first-compounder': {
            mspid: 'first-compounderMSP',
            peers: [
                'peer0.first-compounder'
            ],
            certificateAuthorities: [
                'ica.first-compounder'
            ]
        },
        'second-compounder': {
            mspid: 'second-compounderMSP',
            peers: [
                'peer0.second-compounder'
            ],
            certificateAuthorities: [
                'ica.second-compounder'
            ]
        },
        'third-compounder': {
            mspid: 'third-compounderMSP',
            peers: [
                'peer0.third-compounder'
            ],
            certificateAuthorities: [
                'ica.third-compounder'
            ]
        }
    },
    peers: {
        'peer0.aimplas-notifier': {
            url: 'grpcs://peer0.aimplas-notifier:7051',
            eventUrl: 'grpcs://peer.aimplas-notifier:7052',
            tlsCACerts: {
                path: '/shared-storage/aimplas-notifier/ca-chain.pem'
            }
        },
        'peer0.first-compounder': {
            url: 'grpcs://peer0.first-compounder:7051',
            eventUrl: 'grpcs://peer.first-compounder:7052',
            tlsCACerts: {
                path: '/shared-storage/first-compounder/ca-chain.pem'
            }
        },
        'peer0.second-compounder': {
            url: 'grpcs://peer0.second-compounder:7051',
            eventUrl: 'grpcs://peer.second-compounder:7052',
            tlsCACerts: {
                path: '/shared-storage/second-compounder/ca-chain.pem'
            }
        },
        'peer0.third-compounder': {
            url: 'grpcs://peer0.first-compounder:7051',
            eventUrl: 'grpcs://peer.first-compounder:7052',
            tlsCACerts: {
                path: '/shared-storage/third-compounder/ca-chain.pem'
            }
        }
    },
    certificateAuthorities: {
        'ica.aimplas-notifier': {
            url: 'https://ica.aimplas-notifier:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/aimplas-notifier/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: 'WNS2b3OwX8AqmGKQ',
                    enrollSecret: 'EoOPR3mkPXzDClnY'
                }
            ],
            caName: 'ica.aimplas-notifier'
        },
        'ica.first-compounder': {
            url: 'https://ica.first-compounder:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/first-compounder/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: 'TDtB4EfWbWjX2Bzo',
                    enrollSecret: 'ltTjDWS1dgNbk70m'
                }
            ],
            caName: 'ica.first-compounder'
        },
        'ica.second-compounder': {
            url: 'https://ica.second-compounder:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/second-compounder/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: '1mUs9evZ3TEVdAKx',
                    enrollSecret: 'vGfPyCi5QnwEjd3P'
                }
            ],
            caName: 'ica.second-compounder'
        },
        'ica.third-compounder': {
            url: 'https://ica.third-compounder:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/third-compounder/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: 'jfAtKQnTCnsT0Vb7',
                    enrollSecret: 'TH8Fqxudb0lRT2Ki'
                }
            ],
            caName: 'ica.third-compounder'
        }
    }
};

describe('without custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(
        clientConfig, networkConfig, resolvePath(process.cwd(), 'wallet'));

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('veritas-channel', 'veritas-cc-ley', 'consultarLey', clientConfig.userOrg);
            });

            it('response should be `{}`', async () => {
                expect(response).to.be.equal('{}');
            });

        });
    });

    describe('invoke', () => {

        describe('#init', () => {

            let response: string;

            it('should invoke the chaincode', async () => {
                response = await fabricChaincodeClient.invoke('veritas-channel', 'veritas-cc-ley', 'instantiate');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});

describe('with custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(clientConfig, networkConfig, 'C=SE,ST=Västerås,O=Katet-Corp');

    describe('query', () => {

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('veritas-channel', 'veritas-cc-ley', 'consultarLey', 'aimplas-notifier-veritas-cc-ley');
            });

            it('response should be `{}`', async () => {
                expect(response).to.be.equal('{}');
            });

        });
    });

    describe('invoke', () => {

        describe('#init', () => {

            let response: string;

            it('should invoke the chaincode', async () => {
                response = await fabricChaincodeClient.invoke('veritas-channel', 'veritas-cc-ley', 'upgrade');
            });

            it('response should be `200 OK`', async () => {
                expect(response).to.be.equal('200 OK');
            });

        });
    });
});
