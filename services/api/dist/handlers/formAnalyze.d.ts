export declare function handler(event: {
    body?: string;
}): Promise<{
    statusCode: number;
    headers: {
        "Content-Type": string;
        "Access-Control-Allow-Origin": string;
    };
    body: string;
}>;
