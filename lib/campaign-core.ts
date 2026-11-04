import { load } from 'cheerio/slim';
// Only assets actually referenced by the configured official publishers are accepted.
export function officialImage(raw:unknown,base:string,extraHosts:string[]=[]){
 if(typeof raw!=='string'||!raw.trim())return null;
 try{const u=new URL(raw,base);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 if(!['campaign.kirin.co.jp','www.family.co.jp','panasonic.jp','club.panasonic.jp','www.quocard.com','enjoystarbuckschilled.jp','stories.starbucks.co.jp','about.starbucks.com',...extraHosts].includes(u.hostname))return null;
 if(!/^#!?\//.test(u.hash))u.hash='';return u.href;}catch{return null;}
}
export type CampaignInput={sourceId:string;sourceKey:string;title:string;brand:string;officialUrl:string;sourceUrl:string;summary:string;imageUrl?:string|null;imageSourceUrl?:string|null;category:string;methods:string[];tags:string[];deadline:string|null;startsAt:string|null;winners:number|null;free:boolean|null;noRegistration:boolean|null;daily:boolean|null;instant:boolean|null;ageRestricted:boolean;evidence:Record<string,unknown>};
export const normalize=(v:unknown)=>String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export const clean=(v:unknown)=>load(`<div>${String(v??'')}</div>`).text().replace(/\s+/g,' ').trim();
export function safeUrl(raw:string,base:string){const u=new URL(raw.trim(),base);if(u.protocol!=='https:')throw new Error('HTTPS URL required');for(const k of [...u.searchParams.keys()])if(/^utm_|^fromid$|^scid$/.test(k))u.searchParams.delete(k);if(!/^#!?\//.test(u.hash))u.hash='';return u.href;}
export function parseJSONP(raw:string){const t=raw.replace(/^\uFEFF/,'').trim();return JSON.parse(t.startsWith('[')?t:t.replace(/^[\w$.]+\s*\(/,'').replace(/\)\s*;?$/,''));}
export function jstTime(value:string){if(!value)return null;let v=value.trim();if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(v))v=v.replace(' ','T')+(v.length===16?':00':'')+'+09:00';const d=new Date(v);return Number.isFinite(+d)?d.toISOString():null;}
export function dateFromJapanese(text:string,now=new Date()){
 const normalized=text.normalize('NFKC').replace(/(20\d{2})[/.](\d{1,2})[/.](\d{1,2})/g,'$1年$2月$3日').replace(/日\s*[（(](\d{1,2}:\d{2})(?:まで)?[）)]/g,'日 $1').replace(/(?:AM|午前)\s*(?=\d)/gi,'').replace(/(?:PM|午後)\s*(\d{1,2})(?=[:時])/gi,(_,h)=>String(Number(h)<12?Number(h)+12:Number(h))).replace(/(\d{1,2})時(?:(\d{1,2})分)?/g,(_,h,m)=>h+':'+String(m||0).padStart(2,'0'));
 const rows=[...normalized.matchAll(/(?:(20\d{2})年\s*)?(\d{1,2})\s*月\s*(\d{1,2})日(?:\s*[（(][^）)]*[）)])?(?:\s*(\d{1,2}):([0-5]\d))?/g)];if(!rows.length)return null;
 let lastYear=Number(now.toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'}).slice(0,4)),prevMonth=0,result=null;
 for(const r of rows){let y=r[1]?Number(r[1]):lastYear;const m=Number(r[2]),day=Number(r[3]);if(!r[1]&&prevMonth>=10&&m<=3)y++;const hh=Number(r[4]??23),mm=Number(r[5]??59);if(m<1||m>12||day<1||day>new Date(Date.UTC(y,m,0)).getUTCDate()||hh>23)continue;const d=new Date(`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+09:00`);if(!Number.isNaN(+d)){result=d.toISOString();lastYear=y;prevMonth=m;}}
 return result;
}
export function classify(t:string){const rules:[string,RegExp,string[]][]=[['旅行',/旅行|宿泊|ホテル|温泉|航空券|旅館|リゾート/,['旅行','宿泊']],['家電',/イヤホン|ヘッドホン|スピーカー|ドライヤー|掃除機|テレビ|空気清浄|炊飯器|電子レンジ|冷蔵庫|家電|カメラ/,['家電']],['金券',/ギフトカード|ギフト券|えらべるPay|選べるPay|QUO|ポイント|商品券|現金|Amazonギフト|eGift|eTicket/i,['金券','ギフト券']],['美容',/化粧品|スキンケア|美容|コスメ|シャンプー/,['美容']],['食品',/ビール|飲料|紅茶|コーヒー|食品|グルメ|お茶|生茶|ヨーグルト|ワイン|チューハイ|シャンパーニュ|免疫ケア|お米/,['食品','飲料']],['日用品',/グラス|食器|アパレル|ハチマキ|タオル|衣類|日用品/,['日用品']]];for(const [category,re,tags] of rules)if(re.test(t))return {category,tags};return {category:'その他',tags:[]};}
export function winners(t:string){const text=t.normalize('NFKC'),rows=[...text.matchAll(/(?:合計|総計|抽選で|抽選|先着)?\s*([\d,]+(?:\.\d+)?)\s*(万)?\s*名(?:様|さま|に)?/g)];const total=rows.find(m=>/合計|総計/.test(m[0]));if(!total&&rows.length!==1)return null;const m=total||rows[0];return m?Math.round(Number(m[1].replaceAll(',',''))*(m[2]?10000:1)):null;}
export function inferMethods(t:string){let methods:string[]=[];if(/LINE/.test(t))methods.push('LINE');if(/X\s*[（(]|Twitter|フォロー.*リポスト/.test(t))methods.push('X');if(/Instagram|インスタグラム/.test(t))methods.push('Instagram');if(/アプリ|ファミペイ/.test(t))methods.push('アプリ');if(/アンケート|クイズ/.test(t))methods.push('アンケート');return methods.length?methods:['Web'];}
