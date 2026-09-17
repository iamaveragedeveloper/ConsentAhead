export interface DiscoveredPolicies {
    privacyPolicy: {
        url: string;
        title?: string;
    } | null;
    terms: {
        url: string;
        title?: string;
    } | null;
    deletion: {
        url: string;
        title?: string;
    } | null;
    dataRequest: {
        url: string;
        title?: string;
    } | null;
}
export declare function discoverPolicyLinks(domain: string, pageUrl: string, _pageHtml?: string): Promise<{
    privacyUrl: string | null;
    termsUrl: string | null;
    deletionUrl: string | null;
    dataRequestUrl: string | null;
    allDiscoveredUrls: string[];
}>;
export declare function discoverPolicies(pageUrl: string, domain: string): Promise<DiscoveredPolicies>;
