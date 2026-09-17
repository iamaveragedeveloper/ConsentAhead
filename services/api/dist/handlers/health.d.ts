export declare function handler(): Promise<{
    statusCode: number;
    headers: {
        "Content-Type": string;
        "Access-Control-Allow-Origin": string;
    };
    body: string;
}>;
