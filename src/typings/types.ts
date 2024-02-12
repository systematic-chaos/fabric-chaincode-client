interface IConfigOptions {
    userName: string;
    userOrg: string;
    adminIdentity: string;
    ca: {
        host: string,
        port: string,
        enrollmentId: string,
        enrollmentSecret: string
    };
}

interface IX509Identity {
    credentials: {
        certificate: string,
        privateKey: string
    },
    mspId: string,
    type: string
};

export {
    IConfigOptions,
    IX509Identity
};
