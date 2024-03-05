interface ConfigOptions {
    userName: string;
    userOrg: string;
    adminIdentity: string;
    ca: {
        host: string,
        port: string,
        signingCert: string,
        privateKey: string
    },
    affiliation?: string,
    roles?: string[],
    asLocalhost?: boolean
}

interface NetworkConnectionProfile {
    name: string,
    version: string,
    client: {
        organization: string,
        connection: {
            timeout: {
                peer: {
                    endorser: string | number
                }
            }
        }
    },
    organizations: {
        [key: string]: {
            mspid: string,
            peers: string[],
            certificateAuthorities: string[]
        }
    }
    peers: {
        [key: string]: {
            url: string,
            tlsCACerts: {
                pem: string
            },
            grpcOptions: {
                "ssl-target-name-override": string,
                "hostnameOverride": string
            }
        }
    },
    certificateAuthorities: {
        [key: string]: {
            url: string,
            caName: string,
            tlsCACerts: {
                pem: string[]
            },
            httpOptions: {
                verify: boolean
            }
        }
    }
}

interface X509Identity {
    credentials: {
        certificate: string,
        privateKey: string
    },
    mspId: string,
    type: string
};

export {
    ConfigOptions,
    NetworkConnectionProfile,
    X509Identity
};
