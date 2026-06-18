//CORS relay helper for LiDAR endpoints that return correct payloads but omit
//`Access-Control-Allow-Origin`, so the browser drops the response. Those upstreams route through
//helios-lidar.org/api/lidar-proxy, which fetches server-side and relays with the right CORS header.
//
//The allowlist below is explicit by hostname: only providers known to need the relay are diverted;
//CORS-correct providers stay direct (cheaper bandwidth and round-trip). Adding one is two lines:
//append the hostname here and mirror it on the server-side allowlist in app/lidar_proxy.py.

const PROXY_BASE_URL = 'https://helios-lidar.org/api/lidar-proxy';

const HOSTS_REQUIRING_RELAY: ReadonlySet<string> = new Set([
    'mapy.geoportal.gov.pl',  //Poland, GUGiK NMPT
]);


//Returns the URL the provider should actually fetch: wrapped in the proxy endpoint when the upstream
//hostname needs the relay, otherwise the original URL untouched. Malformed URLs return as-is rather
//than throwing — the fetch then fails and triggers the normal backoff path.
export function lidarFetchUrl(upstreamUrl: string): string
{
    let host: string;
    try
    {
        host = new URL(upstreamUrl).hostname.toLowerCase();
    }
    catch (_)
    {
        return upstreamUrl;
    }
    if (!HOSTS_REQUIRING_RELAY.has(host))
    {
        return upstreamUrl;
    }
    return `${PROXY_BASE_URL}?upstream=${encodeURIComponent(upstreamUrl)}`;
}
