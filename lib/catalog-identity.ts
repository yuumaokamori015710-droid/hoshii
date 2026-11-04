import catalog from './expanded-catalog.json';
export function canonicalCampaignUrl(raw:string){
 const url=new URL(raw);if(!/^#!?\//.test(url.hash))url.hash='';
 for(const key of [...url.searchParams.keys()])if(/^utm_|^(fromid|scid|ke|ref|referrer|fbclid|gclid|srsltid|_gl)$/i.test(key))url.searchParams.delete(key);
 url.searchParams.sort();if(url.pathname!=='/')url.pathname=url.pathname.replace(/\/+$/,'');return url.href;
}
const aliases=new Map(Object.entries(catalog.aliases||{}).map(([from,to])=>[canonicalCampaignUrl(from),canonicalCampaignUrl(String(to))]));
export function canonicalIdentityUrl(raw:string){let key=canonicalCampaignUrl(raw);const visited=new Set<string>();while(aliases.has(key)&&!visited.has(key)){visited.add(key);key=aliases.get(key)!;}return key;}
export function campaignIdentity(c:{officialUrl:string;title:string;deadline?:string|null;evidence?:Record<string,unknown>}){
 const alias=c.evidence?.canonicalCampaignUrl;
 const url=canonicalIdentityUrl(typeof alias==='string'?alias:c.officialUrl),u=new URL(url);
 // A brand's social profile can advertise multiple independent contests.
 if(/(^|\.)(x\.com|twitter\.com|instagram\.com)$/.test(u.hostname)&&!/(\/status\/|\/p\/|\/reel\/)/.test(u.pathname))return url+'|'+c.title.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 return url;
}
