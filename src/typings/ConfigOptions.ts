export interface IConfigOptions {
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