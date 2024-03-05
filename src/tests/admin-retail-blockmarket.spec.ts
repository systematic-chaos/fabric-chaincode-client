import { FabricChaincodeClient } from '..';

import { resolve as resolvePath } from 'path';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';

chai.should();
chai.use(chaiAsPromised);

const clientConfig = {
    userName: 'admin',
    userOrg: 'retail',
    adminIdentity : 'retailMSP',
    ca: {
        host: 'ica.retail',
        port: '7054',
        signingCert: 'KZ3z07alYmTsnJVK',
        privateKey: 'fDheOSz7iRUTmKmf'
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
                'peer.retail': {
                    endorsingPeer: true
                }
            }
        }
    },
    organizations: {
        retail: {
            mspid: 'retailMSP',
            peers: [
                'peer0.retail'
            ],
            certificateAuthorities: [
                'ica.retail'
            ]
        }
    },
    peers: {
        'peer0.retail': {
            url: 'grpcs://peer0.retail:7051',
            eventUrl: 'grpcs://peer.retail:7052',
            tlsCACerts: {
                path: '/shared-storage/retail/ca-chain.pem'
            }
        }
    },
    certificateAuthorities: {
        'ica.retail': {
            url: 'https://ica.retail:7054',
            httpOptions: {
                verify: false
            },
            tlsCACerts: {
                path: '/shared-storage/retail/ca-chain.pem'
            },
            registrar: [
                {
                    enrollId: '397T7l9FHg1zCh8X',
                    enrollSecret: 'vXkaJRJKuoNiEvsS'
                }
            ],
            caName: 'ica.retail'
        }
    }
};

const walletPath = resolvePath(process.cwd(), 'wallet');

const baseTransaction = {
    location: {
        latitude: 0,
        longitude: 0
    },
    type: "LOAD_STARTED",
    comment: "test"
};

describe('Retail without custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(
        clientConfig, networkConfig, walletPath);

    describe('*** FSC ****************', () => {

        const baseOrder = {
            comment: 'Please, deliver between 09:00 and 17:00',
            from: {
                address: 'Camí de Vera, s/n',
                addressComplement: 'Edif. 5G',
                city: 'València',
                company: 'ITI',
                country: 'Spain',
                email: 'johndoe@iti.upv.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 46022,
                vatNumber: '12345678X',
            },
            shippingCompanyId: 'ssc',
            to: {
                address: 'Paseo de la Universidad, 4',
                city: 'Ciudad Real',
                company: 'ESI',
                country: 'Spain',
                email: 'johndoe@esi.uclm.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 13071,
                vatNumber: '12345678X',
            }
        };

        const createdFSCOrdersIds: string[] = [];
        let lastCreatedOrder: any = null;
        let splitOrderId: string = '';
        let totalFSCOrdersInChannel = 0;

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'fsc', 'init');
            });

            it('response should be `200 OK`', async () => {
                chai.expect(response).to.be.equal('200 OK');
            });

        });

        describe('#createOrder', () => {

            it('should fail to create an order from an empty string', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '{"shippingCompanyId": "fsc"}').should.be.rejected;
            });

            it('should fail to create an order from a json if some mandatory field is empty', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '{"shippingCompanyId": "","from": {},"to": {}}').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields of the address', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', 
                            '{"shippingCompanyId": "fsc","from": {"firstName": "John","lastName": "Doe Jr","email": "johndoejr@company.com"},"to": {}}')
                        .should.be.rejected
                ;
            });

            it('should create an order without children nor transactions although they were specified in the json', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();
                orderData.children = ["fsc-9999","fsc-10000"];
                orderData.transactions = [{location:{latitude:0, longitude:0}, type: 'CREATED', comment: 'test'}];

                orderId = await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('fsc')).to.be.true;

                let response: string = '';
                response = await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', orderId);
                const createdOrder: any = JSON.parse(response);

                chai.expect(createdOrder.children === undefined).to.be.true;

                chai.expect(createdOrder.transactions === undefined).to.be.true;

                createdFSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

            it('should create an order', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();

                orderId = await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('fsc')).to.be.true;

                createdFSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

        });

        describe('#orderExists', () => {

            it('should query orderExists for 10000th order and response should be `false`', async () => {
                let response = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', 'fsc-10000');

                chai.expect(response).to.be.equal('false');
            });

            it('should query orderExists for all created FSC orders by this test and responses should be `true`', () => {
                let allExist = true;

                createdFSCOrdersIds.forEach(async (id: string) => {
                    const response = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', id);

                    if (response !== 'true') {
                        allExist = false;
                    }
                });

                chai.expect(allExist).to.be.true;
            });

        });

        describe('#splitOrder', () => {

            it('should invoke splitOrder for last order created, first child order lacking some mandatory field, and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                child1OrderData.shippingCompanyId = '';
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', lastId, childrenJSON).should.be.rejected;
            });

            it('should invoke splitOrder for last order created, one child order for fsc and the other for ssc, and child orders should exist', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();
                child2OrderData.shippingCompanyId = 'ssc';

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', lastId, childrenJSON);

                const childrenIds = JSON.parse(response);

                let childExists = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', childrenIds[0]);
                chai.expect(childExists).to.be.equal('true');
                childExists = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', childrenIds[1]);
                chai.expect(childExists).to.be.equal('true');

                createdFSCOrdersIds.push(childrenIds[0]);
                splitOrderId = lastId;
                lastCreatedOrder = child1OrderData;
                lastCreatedOrder.id = childrenIds[0];
            });

            it('should invoke splitOrder for order with children and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', splitOrderId, childrenJSON).should.be.rejected;
            });

        });

        describe('#readOrder', () => {

            it('should query readOrder for 1000th order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', 'fsc-1000').should.be.rejected;
            });

            it('should query readOrder for last fsc order created and response should be equal to the expected', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', lastCreatedOrder.id);

                const order: any = JSON.parse(response);

                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
                chai.expect(order.shippingCompanyId).to.be.equal(lastCreatedOrder.shippingCompanyId);
                chai.expect(order.comment).to.be.equal(lastCreatedOrder.comment);
                chai.expect(order.from.address).to.be.equal(lastCreatedOrder.from.address);
                chai.expect(order.to.address).to.be.equal(lastCreatedOrder.to.address);
            });

        });

        describe('#addOrderTransaction', () => {

            it('should fail to add transaction if json is empty', async () => {
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, '{}').should.be.rejected;
            });

            it('should fail to add transaction if order does not exist', async () => {
                const transaction: any = clone(baseTransaction);

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', 'not-an-id', JSON.stringify(transaction)).should.be.rejected;
            });

            it('should fail to add transaction if it lacks any mandatory field', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.type = '';
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];
                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, JSON.stringify(transaction)).should.be.rejected;
            });

            it('should add transaction to last created order in fsc and its id should be 0', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should fail to add transaction if order has children and transaction is not of type "CREATED", "READY_FOR_DISPATCH" or "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction)).should.be.rejected;

            });

            it('should add transaction with id 0 if order has children and transaction is of type "CREATED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'CREATED';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should add transaction with id 1 if order has children and transaction is of type "READY_FOR_DISPATCH"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'READY_FOR_DISPATCH';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('1');
            });

            it('should add transaction with id 2 if order has children and transaction is of type "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'RECEIVED';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('2');
            });

        });

        describe('#readFullListOfTransactions', () => {

            it('should query readFullListOfTransactions for a non existing order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'fsc', 'readFullListOfTransactions', 'not-an-id').should.be.rejected;
            });

            it('should query readFullListOfTransactions for the split order and should get 4 transactions', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'readFullListOfTransactions', splitOrderId);

                const transactions = JSON.parse(response);

                chai.expect(transactions.length).to.be.equal(4);
            });

        });

        describe('#getAllOrdersIds', () => {

            it('should query getAllOrdersIds and created orders ids should be part of the answer', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'getAllOrdersIds');
                const ids: string[] = JSON.parse(response);

                let allExists = true;

                createdFSCOrdersIds.forEach((id: string) => {
                    if (!ids.includes(id)) {
                        allExists = false;
                    }
                });

                chai.expect(allExists).to.be.equal(true);

                totalFSCOrdersInChannel = ids.length;
            });

        });

        describe('#getAllOrders', () => {

            let orders: any[] = [];

            it('should query getAllOrders with the pagesize and offset needed so it should get all fsc orders created', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'getAllOrders', (totalFSCOrdersInChannel + 1).toString(), "0");
                orders = JSON.parse(response);

                chai.expect(orders.length).to.be.equal(totalFSCOrdersInChannel);
            });

            it('after sorting them by the order id, last fsc order received should be last order created by this test', () => {
                orders.sort((a: any, b: any) => {
                    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                });

                const order: any = orders[totalFSCOrdersInChannel - 1];
                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
            });

        });

    });

    describe('*** SSC ****************', () => {

        const baseOrder = {
            comment: 'Please, deliver between 09:00 and 17:00',
            from: {
                address: 'Camí de Vera, s/n',
                addressComplement: 'Edif. 5G',
                city: 'València',
                company: 'ITI',
                country: 'Spain',
                email: 'johndoe@iti.upv.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 46022,
                vatNumber: '12345678X',
            },
            shippingCompanyId: 'ssc',
            to: {
                address: 'Paseo de la Universidad, 4',
                city: 'Ciudad Real',
                company: 'ESI',
                country: 'Spain',
                email: 'johndoe@esi.uclm.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 13071,
                vatNumber: '12345678X',
            }
        };
        
        const createdSSCOrdersIds: string[] = [];
        let lastCreatedOrder: any = null;
        let splitOrderId: string = '';
        let totalSSCOrdersInChannel = 0;

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                chai.expect(response).to.be.equal('200 OK');
            });

        });

        describe('#createOrder', () => {

            it('should fail to create an order from an empty string', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '{"shippingCompanyId": "ssc"}').should.be.rejected;
            });

            it('should fail to create an order from a json if some mandatory field is empty', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '{"shippingCompanyId": "","from": {},"to": {}}').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields of the address', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', 
                            '{"shippingCompanyId": "ssc","from": {"firstName": "John","lastName": "Doe Jr","email": "johndoejr@company.com"},"to": {}}')
                        .should.be.rejected
                ;
            });

            it('should create an order without children nor transactions although they were specified in the json', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();
                orderData.children = ["ssc-9999","ssc-10000"];
                orderData.transactions = [{location:{latitude:0, longitude:0}, type: 'CREATED', comment: 'test'}];

                orderId = await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('ssc')).to.be.true;

                let response: string = '';
                response = await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', orderId);
                const createdOrder: any = JSON.parse(response);

                chai.expect(createdOrder.children === undefined).to.be.true;

                chai.expect(createdOrder.transactions === undefined).to.be.true;

                createdSSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

            it('should create an order', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();

                orderId = await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('ssc')).to.be.true;

                createdSSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

        });

        describe('#orderExists', () => {

            it('should query orderExists for 10000th order and response should be `false`', async () => {
                let response = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', 'ssc-10000');

                chai.expect(response).to.be.equal('false');
            });

            it('should query orderExists for all created SSC orders by this test and responses should be `true`', () => {
                let allExist = true;

                createdSSCOrdersIds.forEach(async (id: string) => {
                    const response = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', id);

                    if (response !== 'true') {
                        allExist = false;
                    }
                });

                chai.expect(allExist).to.be.true;
            });

        });

        describe('#splitOrder', () => {

            it('should invoke splitOrder for last order created, first child order lacking some mandatory field, and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                child1OrderData.shippingCompanyId = '';
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', lastId, childrenJSON).should.be.rejected;
            });

            it('should invoke splitOrder for last order created, one child order for ssc and the other for fsc, and child orders should exist', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();
                child2OrderData.shippingCompanyId = 'fsc';

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', lastId, childrenJSON);

                const childrenIds = JSON.parse(response);

                let childExists = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', childrenIds[0]);
                chai.expect(childExists).to.be.equal('true');
                childExists = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', childrenIds[1]);
                chai.expect(childExists).to.be.equal('true');

                createdSSCOrdersIds.push(childrenIds[0]);
                splitOrderId = lastId;
                lastCreatedOrder = child1OrderData;
                lastCreatedOrder.id = childrenIds[0];
            });

            it('should invoke splitOrder for order with children and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', splitOrderId, childrenJSON).should.be.rejected;
            });

        });

        describe('#readOrder', () => {

            it('should query readOrder for 1000th order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', 'ssc-1000').should.be.rejected;
            });

            it('should query readOrder for last ssc order created and response should be equal to the expected', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', lastCreatedOrder.id);

                const order: any = JSON.parse(response);

                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
                chai.expect(order.shippingCompanyId).to.be.equal(lastCreatedOrder.shippingCompanyId);
                chai.expect(order.comment).to.be.equal(lastCreatedOrder.comment);
                chai.expect(order.from.address).to.be.equal(lastCreatedOrder.from.address);
                chai.expect(order.to.address).to.be.equal(lastCreatedOrder.to.address);
            });

        });

        describe('#addOrderTransaction', () => {

            it('should fail to add transaction if json is empty', async () => {
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, '{}').should.be.rejected;
            });

            it('should fail to add transaction if order does not exist', async () => {
                const transaction: any = clone(baseTransaction);

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', 'not-an-id', JSON.stringify(transaction)).should.be.rejected;
            });

            it('should fail to add transaction if it lacks any mandatory field', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.type = '';
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];
                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, JSON.stringify(transaction)).should.be.rejected;
            });

            it('should add transaction to last created order in ssc and its id should be 0', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should fail to add transaction if order has children and transaction is not of type "CREATED", "READY_FOR_DISPATCH" or "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction)).should.be.rejected;

            });

            it('should add transaction with id 0 if order has children and transaction is of type "CREATED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'CREATED';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should add transaction with id 1 if order has children and transaction is of type "READY_FOR_DISPATCH"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'READY_FOR_DISPATCH';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('1');
            });

            it('should add transaction with id 2 if order has children and transaction is of type "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'RECEIVED';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('2');
            });

        });

        describe('#readFullListOfTransactions', () => {

            it('should query readFullListOfTransactions for a non existing order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'ssc', 'readFullListOfTransactions', 'not-an-id').should.be.rejected;
            });

            it('should query readFullListOfTransactions for the split order and should get 4 transactions', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'readFullListOfTransactions', splitOrderId);

                const transactions = JSON.parse(response);

                chai.expect(transactions.length).to.be.equal(4);
            });

        });

        describe('#getAllOrdersIds', () => {

            it('should query getAllOrdersIds and created orders ids should be part of the answer', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'getAllOrdersIds');
                const ids: string[] = JSON.parse(response);

                let allExists = true;

                createdSSCOrdersIds.forEach((id: string) => {
                    if (!ids.includes(id)) {
                        allExists = false;
                    }
                });

                chai.expect(allExists).to.be.equal(true);

                totalSSCOrdersInChannel = ids.length;
            });

        });

        describe('#getAllOrders', () => {

            let orders: any[] = [];

            it('should query getAllOrders with the pagesize and offset needed so it should get all ssc orders created', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'getAllOrders', (totalSSCOrdersInChannel + 1).toString(), "0");
                orders = JSON.parse(response);

                chai.expect(orders.length).to.be.equal(totalSSCOrdersInChannel);
            });

            it('after sorting them by the order id, last ssc order received should be last order created by this test', () => {
                orders.sort((a: any, b: any) => {
                    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                });

                const order: any = orders[totalSSCOrdersInChannel - 1];
                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
            });

        });
    });

});

describe('Retail with custom distinguished name attributes', () => {

    const fabricChaincodeClient = new FabricChaincodeClient(
        clientConfig, networkConfig, walletPath);

    describe('*** FSC ****************', () => {

        const baseOrder = {
            comment: 'Please, deliver between 09:00 and 17:00',
            from: {
                address: 'Camí de Vera, s/n',
                addressComplement: 'Edif. 5G',
                city: 'València',
                company: 'ITI',
                country: 'Spain',
                email: 'johndoe@iti.upv.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 46022,
                vatNumber: '12345678X',
            },
            shippingCompanyId: 'ssc',
            to: {
                address: 'Paseo de la Universidad, 4',
                city: 'Ciudad Real',
                company: 'ESI',
                country: 'Spain',
                email: 'johndoe@esi.uclm.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 13071,
                vatNumber: '12345678X',
            }
        };

        const createdFSCOrdersIds: string[] = [];
        let lastCreatedOrder: any = null;
        let splitOrderId: string = '';
        let totalFSCOrdersInChannel = 0;

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'fsc', 'init');
            });

            it('response should be `200 OK`', async () => {
                chai.expect(response).to.be.equal('200 OK');
            });

        });

        describe('#createOrder', () => {

            it('should fail to create an order from an empty string', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '{"shippingCompanyId": "fsc"}').should.be.rejected;
            });

            it('should fail to create an order from a json if some mandatory field is empty', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', '{"shippingCompanyId": "","from": {},"to": {}}').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields of the address', async () => {
                await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', 
                            '{"shippingCompanyId": "fsc","from": {"firstName": "John","lastName": "Doe Jr","email": "johndoejr@company.com"},"to": {}}')
                        .should.be.rejected
                ;
            });

            it('should create an order without children nor transactions although they were specified in the json', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();
                orderData.children = ["fsc-9999","fsc-10000"];
                orderData.transactions = [{location:{latitude:0, longitude:0}, type: 'CREATED', comment: 'test'}];

                orderId = await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('fsc')).to.be.true;

                let response: string = '';
                response = await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', orderId);
                const createdOrder: any = JSON.parse(response);

                chai.expect(createdOrder.children === undefined).to.be.true;

                chai.expect(createdOrder.transactions === undefined).to.be.true;

                createdFSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

            it('should create an order', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();

                orderId = await fabricChaincodeClient.invoke('retail', 'fsc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('fsc')).to.be.true;

                createdFSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

        });

        describe('#orderExists', () => {

            it('should query orderExists for 10000th order and response should be `false`', async () => {
                let response = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', 'fsc-10000');

                chai.expect(response).to.be.equal('false');
            });

            it('should query orderExists for all created FSC orders by this test and responses should be `true`', () => {
                let allExist = true;

                createdFSCOrdersIds.forEach(async (id: string) => {
                    const response = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', id);

                    if (response !== 'true') {
                        allExist = false;
                    }
                });

                chai.expect(allExist).to.be.true;
            });

        });

        describe('#splitOrder', () => {

            it('should invoke splitOrder for last order created, first child order lacking some mandatory field, and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                child1OrderData.shippingCompanyId = '';
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', lastId, childrenJSON).should.be.rejected;
            });

            it('should invoke splitOrder for last order created, one child order for fsc and the other for ssc, and child orders should exist', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();
                child2OrderData.shippingCompanyId = 'ssc';

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', lastId, childrenJSON);

                const childrenIds = JSON.parse(response);

                let childExists = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', childrenIds[0]);
                chai.expect(childExists).to.be.equal('true');
                childExists = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', childrenIds[1]);
                chai.expect(childExists).to.be.equal('true');

                createdFSCOrdersIds.push(childrenIds[0]);
                splitOrderId = lastId;
                lastCreatedOrder = child1OrderData;
                lastCreatedOrder.id = childrenIds[0];
            });

            it('should invoke splitOrder for order with children and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                await fabricChaincodeClient.invoke('retail', 'fsc', 'splitOrder', splitOrderId, childrenJSON).should.be.rejected;
            });

        });

        describe('#readOrder', () => {

            it('should query readOrder for 1000th order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', 'fsc-1000').should.be.rejected;
            });

            it('should query readOrder for last fsc order created and response should be equal to the expected', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'readOrder', lastCreatedOrder.id);

                const order: any = JSON.parse(response);

                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
                chai.expect(order.shippingCompanyId).to.be.equal(lastCreatedOrder.shippingCompanyId);
                chai.expect(order.comment).to.be.equal(lastCreatedOrder.comment);
                chai.expect(order.from.address).to.be.equal(lastCreatedOrder.from.address);
                chai.expect(order.to.address).to.be.equal(lastCreatedOrder.to.address);
            });

        });

        describe('#addOrderTransaction', () => {

            it('should fail to add transaction if json is empty', async () => {
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, '{}').should.be.rejected;
            });

            it('should fail to add transaction if order does not exist', async () => {
                const transaction: any = clone(baseTransaction);

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', 'not-an-id', JSON.stringify(transaction)).should.be.rejected;
            });

            it('should fail to add transaction if it lacks any mandatory field', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.type = '';
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];
                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, JSON.stringify(transaction)).should.be.rejected;
            });

            it('should add transaction to last created order in fsc and its id should be 0', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdFSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', lastId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should fail to add transaction if order has children and transaction is not of type "CREATED", "READY_FOR_DISPATCH" or "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();

                await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction)).should.be.rejected;

            });

            it('should add transaction with id 0 if order has children and transaction is of type "CREATED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'CREATED';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should add transaction with id 1 if order has children and transaction is of type "READY_FOR_DISPATCH"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'READY_FOR_DISPATCH';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('1');
            });

            it('should add transaction with id 2 if order has children and transaction is of type "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'RECEIVED';

                const response = await fabricChaincodeClient.invoke('retail', 'fsc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('2');
            });

        });

        describe('#readFullListOfTransactions', () => {

            it('should query readFullListOfTransactions for a non existing order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'fsc', 'readFullListOfTransactions', 'not-an-id').should.be.rejected;
            });

            it('should query readFullListOfTransactions for the split order and should get 4 transactions', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'readFullListOfTransactions', splitOrderId);

                const transactions = JSON.parse(response);

                chai.expect(transactions.length).to.be.equal(4);
            });

        });

        describe('#getAllOrdersIds', () => {

            it('should query getAllOrdersIds and created orders ids should be part of the answer', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'getAllOrdersIds');
                const ids: string[] = JSON.parse(response);

                let allExists = true;

                createdFSCOrdersIds.forEach((id: string) => {
                    if (!ids.includes(id)) {
                        allExists = false;
                    }
                });

                chai.expect(allExists).to.be.equal(true);

                totalFSCOrdersInChannel = ids.length;
            });

        });

        describe('#getAllOrders', () => {

            let orders: any[] = [];

            it('should query getAllOrders with the pagesize and offset needed so it should get all fsc orders created', async () => {
                const response = await fabricChaincodeClient.query('retail', 'fsc', 'getAllOrders', (totalFSCOrdersInChannel + 1).toString(), "0");
                orders = JSON.parse(response);

                chai.expect(orders.length).to.be.equal(totalFSCOrdersInChannel);
            });

            it('after sorting them by the order id, last fsc order received should be last order created by this test', () => {
                orders.sort((a: any, b: any) => {
                    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                });

                const order: any = orders[totalFSCOrdersInChannel - 1];
                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
            });

        });

    });

    describe('*** SSC ****************', () => {

        const baseOrder = {
            comment: 'Please, deliver between 09:00 and 17:00',
            from: {
                address: 'Camí de Vera, s/n',
                addressComplement: 'Edif. 5G',
                city: 'València',
                company: 'ITI',
                country: 'Spain',
                email: 'johndoe@iti.upv.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 46022,
                vatNumber: '12345678X',
            },
            shippingCompanyId: 'ssc',
            to: {
                address: 'Paseo de la Universidad, 4',
                city: 'Ciudad Real',
                company: 'ESI',
                country: 'Spain',
                email: 'johndoe@esi.uclm.es',
                lastname: 'Doe',
                name: 'John',
                phoneNumber: 655987654,
                postalCode: 13071,
                vatNumber: '12345678X',
            }
        };
        
        const createdSSCOrdersIds: string[] = [];
        let lastCreatedOrder: any = null;
        let splitOrderId: string = '';
        let totalSSCOrdersInChannel = 0;

        describe('#init', () => {

            let response: string;

            it('should query the chaincode', async () => {
                response = await fabricChaincodeClient.query('retail', 'ssc', 'init');
            });

            it('response should be `200 OK`', async () => {
                chai.expect(response).to.be.equal('200 OK');
            });

        });

        describe('#createOrder', () => {

            it('should fail to create an order from an empty string', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '{"shippingCompanyId": "ssc"}').should.be.rejected;
            });

            it('should fail to create an order from a json if some mandatory field is empty', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', '{"shippingCompanyId": "","from": {},"to": {}}').should.be.rejected;
            });

            it('should fail to create an order from a json lacking some mandatory fields of the address', async () => {
                await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', 
                            '{"shippingCompanyId": "ssc","from": {"firstName": "John","lastName": "Doe Jr","email": "johndoejr@company.com"},"to": {}}')
                        .should.be.rejected
                ;
            });

            it('should create an order without children nor transactions although they were specified in the json', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();
                orderData.children = ["ssc-9999","ssc-10000"];
                orderData.transactions = [{location:{latitude:0, longitude:0}, type: 'CREATED', comment: 'test'}];

                orderId = await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('ssc')).to.be.true;

                let response: string = '';
                response = await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', orderId);
                const createdOrder: any = JSON.parse(response);

                chai.expect(createdOrder.children === undefined).to.be.true;

                chai.expect(createdOrder.transactions === undefined).to.be.true;

                createdSSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

            it('should create an order', async () => {
                let orderId: string = '';

                const orderData: any = clone(baseOrder);
                orderData.comment = (new Date()).toISOString();

                orderId = await fabricChaincodeClient.invoke('retail', 'ssc', 'createOrder', JSON.stringify(orderData));

                chai.expect(orderId.startsWith('ssc')).to.be.true;

                createdSSCOrdersIds.push(orderId);
                orderData.id = orderId;
                lastCreatedOrder = orderData;
            });

        });

        describe('#orderExists', () => {

            it('should query orderExists for 10000th order and response should be `false`', async () => {
                let response = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', 'ssc-10000');

                chai.expect(response).to.be.equal('false');
            });

            it('should query orderExists for all created SSC orders by this test and responses should be `true`', () => {
                let allExist = true;

                createdSSCOrdersIds.forEach(async (id: string) => {
                    const response = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', id);

                    if (response !== 'true') {
                        allExist = false;
                    }
                });

                chai.expect(allExist).to.be.true;
            });

        });

        describe('#splitOrder', () => {

            it('should invoke splitOrder for last order created, first child order lacking some mandatory field, and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                child1OrderData.shippingCompanyId = '';
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', lastId, childrenJSON).should.be.rejected;
            });

            it('should invoke splitOrder for last order created, one child order for ssc and the other for fsc, and child orders should exist', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();
                child2OrderData.shippingCompanyId = 'fsc';

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', lastId, childrenJSON);

                const childrenIds = JSON.parse(response);

                let childExists = await fabricChaincodeClient.query('retail', 'ssc', 'orderExists', childrenIds[0]);
                chai.expect(childExists).to.be.equal('true');
                childExists = await fabricChaincodeClient.query('retail', 'fsc', 'orderExists', childrenIds[1]);
                chai.expect(childExists).to.be.equal('true');

                createdSSCOrdersIds.push(childrenIds[0]);
                splitOrderId = lastId;
                lastCreatedOrder = child1OrderData;
                lastCreatedOrder.id = childrenIds[0];
            });

            it('should invoke splitOrder for order with children and it should fail', async () => {
                const child1OrderData: any = clone(baseOrder);
                child1OrderData.comment = (new Date()).toISOString();
                const child2OrderData: any = clone(baseOrder);
                child2OrderData.comment = (new Date()).toISOString();

                const childrenJSON: string = JSON.stringify([child1OrderData, child2OrderData]);

                await fabricChaincodeClient.invoke('retail', 'ssc', 'splitOrder', splitOrderId, childrenJSON).should.be.rejected;
            });

        });

        describe('#readOrder', () => {

            it('should query readOrder for 1000th order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', 'ssc-1000').should.be.rejected;
            });

            it('should query readOrder for last ssc order created and response should be equal to the expected', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'readOrder', lastCreatedOrder.id);

                const order: any = JSON.parse(response);

                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
                chai.expect(order.shippingCompanyId).to.be.equal(lastCreatedOrder.shippingCompanyId);
                chai.expect(order.comment).to.be.equal(lastCreatedOrder.comment);
                chai.expect(order.from.address).to.be.equal(lastCreatedOrder.from.address);
                chai.expect(order.to.address).to.be.equal(lastCreatedOrder.to.address);
            });

        });

        describe('#addOrderTransaction', () => {

            it('should fail to add transaction if json is empty', async () => {
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, '{}').should.be.rejected;
            });

            it('should fail to add transaction if order does not exist', async () => {
                const transaction: any = clone(baseTransaction);

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', 'not-an-id', JSON.stringify(transaction)).should.be.rejected;
            });

            it('should fail to add transaction if it lacks any mandatory field', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.type = '';
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];
                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, JSON.stringify(transaction)).should.be.rejected;
            });

            it('should add transaction to last created order in ssc and its id should be 0', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                const lastId: string = createdSSCOrdersIds.slice(-1)[0];

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', lastId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should fail to add transaction if order has children and transaction is not of type "CREATED", "READY_FOR_DISPATCH" or "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();

                await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction)).should.be.rejected;

            });

            it('should add transaction with id 0 if order has children and transaction is of type "CREATED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'CREATED';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('0');
            });

            it('should add transaction with id 1 if order has children and transaction is of type "READY_FOR_DISPATCH"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'READY_FOR_DISPATCH';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('1');
            });

            it('should add transaction with id 2 if order has children and transaction is of type "RECEIVED"', async () => {
                const transaction: any = clone(baseTransaction);
                transaction.comment = (new Date()).toISOString();
                transaction.type = 'RECEIVED';

                const response = await fabricChaincodeClient.invoke('retail', 'ssc', 'addOrderTransaction', splitOrderId, JSON.stringify(transaction));

                chai.expect(response).to.be.equal('2');
            });

        });

        describe('#readFullListOfTransactions', () => {

            it('should query readFullListOfTransactions for a non existing order and it should fail', async () => {
                await fabricChaincodeClient.query('retail', 'ssc', 'readFullListOfTransactions', 'not-an-id').should.be.rejected;
            });

            it('should query readFullListOfTransactions for the split order and should get 4 transactions', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'readFullListOfTransactions', splitOrderId);

                const transactions = JSON.parse(response);

                chai.expect(transactions.length).to.be.equal(4);
            });

        });

        describe('#getAllOrdersIds', () => {

            it('should query getAllOrdersIds and created orders ids should be part of the answer', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'getAllOrdersIds');
                const ids: string[] = JSON.parse(response);

                let allExists = true;

                createdSSCOrdersIds.forEach((id: string) => {
                    if (!ids.includes(id)) {
                        allExists = false;
                    }
                });

                chai.expect(allExists).to.be.equal(true);

                totalSSCOrdersInChannel = ids.length;
            });

        });

        describe('#getAllOrders', () => {

            let orders: any[] = [];

            it('should query getAllOrders with the pagesize and offset needed so it should get all ssc orders created', async () => {
                const response = await fabricChaincodeClient.query('retail', 'ssc', 'getAllOrders', (totalSSCOrdersInChannel + 1).toString(), "0");
                orders = JSON.parse(response);

                chai.expect(orders.length).to.be.equal(totalSSCOrdersInChannel);
            });

            it('after sorting them by the order id, last ssc order received should be last order created by this test', () => {
                orders.sort((a: any, b: any) => {
                    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                });

                const order: any = orders[totalSSCOrdersInChannel - 1];
                chai.expect(order.id).to.be.equal(lastCreatedOrder.id);
            });

        });
    });

});

function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}