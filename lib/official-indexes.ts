import { load } from 'cheerio/slim';
import catalog from './expanded-catalog.json';
import { clean, safeUrl, dateFromJapanese, classify, winners, inferMethods, officialImage, parseJSONP,jstTime,type CampaignInput } from './campaign-core';
import { canonicalCampaignUrl,canonicalIdentityUrl } from './catalog-identity';

export type IndexSource={id:string;name:string;url:string;selector:string;title?:string;link?:string;image?:string;period?:string;prize?:string;metadataPriority?:number;requireDate?:boolean;currentSelector?:string;kind?:string;dataUrl?:string;method?:string;body?:string;pages?:string[];selfEvidence?:boolean;requireSelector?:string;pageRecords?:Record<string,string[]>;emptyState?:string};
export const DYNAMIC_INDEXES:IndexSource[]=[
 {id:'asahi-beer',name:'アサヒビール',url:'https://www.asahibeer.co.jp/campaign/',selector:'.p-campaignList_item',title:'.p-campaign_title',period:'.p-campaign_date',prize:'.p-accordionItem_content',link:'a[href]',image:'.p-campaign_pic img',requireDate:true,metadataPriority:3},
 {id:'asahi-inryo',name:'アサヒ飲料',url:'https://www.asahiinryo.co.jp/campaign/',selector:'.campaign-list>li',title:'.campaign-list__tit',period:'.campaign-list__date',prize:'.m-text',link:'a[href]',image:'.campaign-list__img img',requireDate:true,metadataPriority:3},
 {id:'maruchan',name:'東洋水産',url:'https://www.maruchan.co.jp/campaign/',selector:'.list_3__item',title:'.list_3__p1',period:'.list_3__p2',prize:'.list_3__p2',link:'a[href]',image:'img',requireDate:true,metadataPriority:3},
 {id:'nipponham',name:'日本ハム',url:'https://www.nipponham.co.jp/campaign/',selector:'.campaign-block-item',title:'h3',period:'.campaign-date',prize:'.campaign-list',link:'a[href]',image:'img',requireDate:true,metadataPriority:3},
 {id:'unicharm',name:'ユニ・チャーム',url:'https://www.unicharm.co.jp/ja/campaign.html',selector:'main .uc-item',title:'.uc-title',period:'.uc-tag',link:'a[href]',image:'.uc-media img',requireDate:true,metadataPriority:3},
 {id:'nagatanien',name:'永谷園',url:'https://www.nagatanien.co.jp/cp_event/',selector:'.cp_event-index-list__item',title:'h3',link:'h3 a',image:'.c-media-01__img img',requireDate:true,metadataPriority:3},
 {id:'morinaga-milk',name:'森永乳業',url:'https://www.morinagamilk.co.jp/campaign/',selector:'.campaign-item',title:'h2',period:'tr:has(th:contains("応募期間")) td',prize:'tr:has(th:contains("賞品")) td',image:'figure img',requireDate:true,metadataPriority:3},
 {id:'morinaga-seika',name:'森永製菓',url:'https://www.morinaga.co.jp/campaign/?action_campaign_api_list=true&type=mobile',selector:'.campaign-list__item',title:'.campaign-list__title',period:'.campaign-list__schedule',prize:'.campaign-list__text',image:'.campaign-list__image img',requireDate:true,metadataPriority:3},
 {id:'meiji',name:'明治',url:'https://www.meiji.co.jp/campaign/index.html',selector:'.campaign-list .js-scroll-item',title:'.m-txtLink-strong-block',period:'.m-txt.u-mt-auto',image:'.l-card-visual-img img',requireDate:true,metadataPriority:3},
 {id:'sapporo',name:'サッポロビール',url:'https://www.sapporobeer.jp/campaign/',selector:'a.m-campaign_items-box',title:'.m-campaign_item-title',period:'.m-campaign_item-limit',prize:'.m-campaign_item-description',requireDate:true,metadataPriority:3},
 {id:'nissin',name:'日清食品グループ',url:'https://www.nissin.com/jp/product/campaigns/',selector:'.CardCampaign',title:'.title',period:'.description',requireDate:true,metadataPriority:3},
 {id:'kikkoman',name:'キッコーマン',url:'https://www.kikkoman.co.jp/campaign/',selector:'.campaign-card',title:'.campaign-card__title',period:'.campaign-card__schedule__list',prize:'.campaign-card__description',requireDate:true,metadataPriority:3},
];
export const SNAPSHOT_SOURCES=catalog.sources as IndexSource[];
export const SNAPSHOT_RECORDS=catalog.records as CampaignInput[];
export const ADDITIONAL_SOURCES=[...DYNAMIC_INDEXES,...SNAPSHOT_SOURCES];
export const ADDITIONAL_IMAGE_HOSTS=[...new Set([...ADDITIONAL_SOURCES.map(s=>new URL(s.url).hostname),...SNAPSHOT_RECORDS.filter(c=>c.imageUrl).map(c=>new URL(c.imageUrl!).hostname)])];
const reviewedAliases=new Map(SNAPSHOT_RECORDS.filter(c=>typeof c.evidence.canonicalCampaignUrl==='string').map(c=>[canonicalCampaignUrl(c.officialUrl),canonicalCampaignUrl(String(c.evidence.canonicalCampaignUrl))]));
function listingIdentity(raw:string){const key=canonicalIdentityUrl(raw);return reviewedAliases.get(key)||key;}
const closed=/応募受付終了(?!後|まで)|受付終了(?!後|まで)|キャンペーンは終了(?!後|まで)|キャンペーン終了(?=$|[\s!！。])|終了しました|募集終了|応募は終了/;
const irrelevant=/抽選販売|購入権の|購入権が|入場券販売|先行販売|チケット販売/;
function textWithAlt($:any,el:any){const clone=$(el).clone();clone.find('script,style').remove();clone.find('img[alt]').each((_:number,img:any)=>$(img).replaceWith(' '+$(img).attr('alt')+' '));return clean(clone.text());}
function field($:any,card:any,selector?:string){return selector?clean(card.find(selector).text()):'';}
function explicitEmpty(source:IndexSource,$:any){return !!source.emptyState&&textWithAlt($,$('body')).includes(source.emptyState);}
function applicationPeriod(text:string){
 const normal=text.normalize('NFKC').replace(/\s*(?:AM|午前)\s*(?=\d)/gi,' ').replace(/(?:PM|午後)\s*(\d{1,2}):/gi,(_,h)=>String(Number(h)<12?Number(h)+12:Number(h))+':');
 const section=normal.split(/応募(?:期間|締切)|実施期間|キャンペーン期間/).at(-1)||normal;
 return section.split(/賞品内容|レシート有効|対象購入|購入対象|当選発表|抽選日|詳しい応募方法|「永谷園アプリ」のダウンロード/)[0].trim();
}
export function parseOfficialIndex(source:IndexSource,raw:string,now=new Date()):CampaignInput[]{
 const $=load(raw),cards=$(source.selector);if(!cards.length){if(explicitEmpty(source,$))return [];throw new Error(source.name+'公式一覧の構造が変わりました');}
 const result:CampaignInput[]=[],seen=new Set<string>();
 cards.each((_,el)=>{
  const card=$(el),text=textWithAlt($,el);if(closed.test(text)||irrelevant.test(text)||!/当たる|あたる|抽選|プレゼント|もらえる|貰える|無料クーポン|賞品・当選人数/.test(text))return;
  let title=field($,card,source.title);if(!title&&source.id==='unicharm')title=clean(card.find('a').text()).replace(/^20\d{2}年\d+月\d+日\s*/, '');
  if(!title||title.length>400)return;
  const link=card.is('a')?card:card.find(source.link||'a[href]').first();const href=link.attr('href');if(!href||href.startsWith('#'))return;
  let officialUrl;try{officialUrl=safeUrl(href,source.url);}catch{return;}
  if(seen.has(officialUrl))return;
  const rawPeriod=field($,card,source.period)||text;
  const period=applicationPeriod(rawPeriod),deadline=dateFromJapanese(period,now);
  if(source.requireDate&&!deadline)return;if(deadline&&new Date(deadline)<=now)return;
  const range=period.split(/[～~〜]/);let startsAt=null;
  if(range.length>1){const first=dateFromJapanese(range[0],now);if(first){startsAt=/\d{1,2}:\d{2}/.test(range[0])?first:first.replace(/T14:59:00\.000Z$/,'T15:00:00.000Z');if(startsAt&& !/\d{1,2}:\d{2}/.test(range[0]))startsAt=new Date(new Date(first).getTime()-86340000).toISOString();if(startsAt&&new Date(startsAt)>now)return;}}
  const prize=field($,card,source.prize),summary=(prize||text).slice(0,1100),classified=classify(title+' '+summary),image=card.find(source.image||'img').first();seen.add(officialUrl);
  const methods=inferMethods(text);if(/はがき|ハガキ/.test(text)&&!methods.includes('はがき'))methods.push('はがき');
  result.push({sourceId:source.id,sourceKey:source.id+':'+canonicalCampaignUrl(officialUrl),title,brand:source.name,officialUrl,sourceUrl:source.url,summary,
   imageUrl:officialImage(image.attr('src')||image.attr('data-src')||image.attr('data-original'),source.url,ADDITIONAL_IMAGE_HOSTS),imageSourceUrl:source.url,...classified,methods,
   tags:[...classified.tags,...(/モニター|レビュー|口コミ投稿/.test(text)?['モニター','レビュー条件あり']:[])],deadline,startsAt,winners:winners(prize||text),
   free:/購入不要|商品購入は不要/.test(text)?true:/購入|買って|買うと|レシート|シールを集め/.test(text)?false:null,noRegistration:/会員登録不要/.test(text)?true:/会員限定|会員登録が必要|会員登録が必要|新規会員登録/.test(text)?false:null,daily:/1日1回|毎日応募/.test(text)?true:null,instant:/その場で/.test(text)?true:null,ageRestricted:/20歳以上|満20歳/.test(text),
   evidence:{checkedFrom:'official_publisher_index',period:rawPeriod,selector:source.selector,metadataPriority:source.metadataPriority??2,periodRequiresConfirmation:!deadline}
  });
 });return result.reverse();
}
export function revalidateSnapshot(source:IndexSource,raw:string,now=new Date(),pageUrl=source.url):CampaignInput[]{
 if(source.kind==='docomo-index')return parseDocomoIndex(source,raw,now);
 if(['vpoint','jcb','aupay','dpay','sugi'].includes(source.kind||''))return revalidateStructured(source,raw,now);
 const $=load(raw),cards=$(source.currentSelector||source.selector);if(!cards.length){if(explicitEmpty(source,$))return [];throw new Error(source.name+'公式一覧の構造が変わりました');}
 const urls=new Map<string,{text:string;classes:string}[]>();
 cards.each((_,el)=>{const card=$(el),text=textWithAlt($,el);if(closed.test(text)||irrelevant.test(text)||source.requireSelector&&!card.find(source.requireSelector).length)return;const anchors=card.is('a[href]')?card:card.find('a[href]');anchors.each((_,a)=>{try{const url=listingIdentity(safeUrl($(a).attr('href')!,source.url));const values=urls.get(url)||[];values.push({text,classes:card.attr('class')||''});urls.set(url,values);}catch{}});});
 return SNAPSHOT_RECORDS.filter(c=>c.sourceId===source.id).filter(c=>{
  if(c.deadline&&new Date(c.deadline)<=now||c.startsAt&&new Date(c.startsAt)>now)return false;
  if(!c.deadline&&c.evidence.listedPeriodEnd&&new Date(String(c.evidence.listedPeriodEnd))<=now)return false;
  if(source.selfEvidence){const title=c.title.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').slice(0,15);const text=textWithAlt($,cards);const body=text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');const titleMatches=!!title&&body.includes(title);const imageMatches=!!c.imageUrl&&cards.find('img').toArray().some((img:any)=>{try{return safeUrl($(img).attr('src')||$(img).attr('data-src')||'',pageUrl)===c.imageUrl;}catch{return false;}});const exact=canonicalCampaignUrl(pageUrl)===canonicalCampaignUrl(c.sourceUrl)||canonicalCampaignUrl(pageUrl)===canonicalCampaignUrl(c.officialUrl)||Object.entries(source.pageRecords||{}).some(([u,keys])=>canonicalCampaignUrl(u)===canonicalCampaignUrl(pageUrl)&&keys.includes(c.sourceKey));if(exact&&!closed.test(text)&&(titleMatches||(imageMatches||/プレゼント|抽選|当たる|応募|モニター/.test(text))&&!!c.deadline))return true;}
  let entries=urls.get(listingIdentity(c.officialUrl));
  if(!entries&&source.id==='jcom'&&/okaimonojourney.*all/.test(c.officialUrl))entries=[...urls].filter(([url])=>url.includes('okaimonojourney2026_autumn')).flatMap(([,entries])=>entries);
  if(!entries?.length)return false;
  if(source.id==='jcom')return entries.some(x=>{const start=x.classes.match(/start-date_(\d{4})(\d{2})(\d{2})/),end=x.classes.match(/close-date_(\d{4})(\d{2})(\d{2})/);return (!start||new Date(`${start[1]}-${start[2]}-${start[3]}T00:00:00+09:00`)<=now)&&(!end||new Date(`${end[1]}-${end[2]}-${end[3]}T23:59:00+09:00`)>now);});
  return true;
 }).map(c=>({...c,evidence:{...c.evidence,checkedFrom:'official_index_revalidated',metadataPriority:source.metadataPriority??2}}));
}
function revalidateStructured(source:IndexSource,raw:string,now:Date){
 let ids=new Map<string,any>();
 if(source.kind==='vpoint'){const $=load(raw);const data=JSON.parse($('#__NEXT_DATA__').text());const rows=data?.props?.pageProps?.data?.campaigns;if(!Array.isArray(rows))throw new Error('Vポイント公式データの形式が変わりました');ids=new Map(rows.map((r:any)=>[String(r.id),r]));}
 else if(source.kind==='aupay'){const rows=JSON.parse(raw)?.campaign?.being_held;if(!Array.isArray(rows))throw new Error('au PAY公式データの形式が変わりました');ids=new Map(rows.map((r:any)=>[canonicalCampaignUrl(safeUrl(r.banner_url,source.url)),r]));}
 else if(source.kind==='dpay'){const data=parseJSONP(raw),rows=data?.items?.[0]?.contents;if(data.status!=='ok'||!Array.isArray(rows))throw new Error('d払い公式データを確認できませんでした');ids=new Map(rows.map((r:any)=>[canonicalCampaignUrl(safeUrl(r.pageURL1,source.url)),r]));}
 else if(source.kind==='sugi'){const rows=JSON.parse(raw)?.articles;if(!Array.isArray(rows))throw new Error('スギ薬局公式データの形式が変わりました');ids=new Map(rows.map((r:any)=>[String(r.id),r]));}
 else{const data=JSON.parse(raw);const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.eventCode)ids.set(String(v.eventCode),v);for(const x of Object.values(v))if(x&&typeof x==='object')visit(x);};visit(data);if(!ids.size)throw new Error('JCB公式データの形式が変わりました');}
 return SNAPSHOT_RECORDS.filter(c=>c.sourceId===source.id&&(!c.deadline||new Date(c.deadline)>now)&&(!c.startsAt||new Date(c.startsAt)<=now)).filter(c=>ids.has(source.kind==='aupay'||source.kind==='dpay'?canonicalCampaignUrl(c.officialUrl):source.kind==='sugi'?(/sugi-channel\/(\d+)/.exec(c.officialUrl)?.[1]||String(c.evidence.articleId)):String(c.evidence.id||c.evidence.eventCode))).map(c=>({...c,evidence:{...c.evidence,checkedFrom:'official_structured_data_revalidated',metadataPriority:3}}));
}
export function parseDocomoIndex(source:IndexSource,raw:string,now=new Date()):CampaignInput[]{
 const data=parseJSONP(raw);if(!Array.isArray(data.campaign_list))throw new Error('dポイント公式データの形式が変わりました');
 return data.campaign_list.map((r:any)=>r.campaign).filter((r:any)=>{
  const p=r.abailable_period;if(!p||!/抽選|当たる|あたる|くじ/.test(r.contents_info?.title||''))return false;
  return [p.start_date,p.published_date].every(v=>!v||new Date(jstTime(v)!)<=now)&&[p.end_date,p.close_date].every(v=>!v||new Date(jstTime(v)!)>now);
 }).map((r:any)=>{
  const info=r.contents_info,p=r.abailable_period,title=clean(info.title),officialUrl=safeUrl(info.contents_url,source.url),classified=classify(title);
  return {sourceId:source.id,sourceKey:'dpoint:'+r.campaign_id,title,brand:clean(r.relational_store_info?.relational_store_name)||'dポイントクラブ',officialUrl,sourceUrl:source.url,
   imageUrl:officialImage(info.contents_banner_image_url,source.url,ADDITIONAL_IMAGE_HOSTS),imageSourceUrl:source.url,summary:title+'。対象店舗・会員・決済などの応募条件とポイントの利用条件は公式ページでご確認ください。',...classified,
   tags:[...classified.tags,'ポイント'],methods:['Web'],deadline:jstTime(p.end_date),startsAt:jstTime(p.start_date),winners:winners(title),free:null,noRegistration:false,daily:/毎日|1日1回/.test(title)?true:null,instant:/その場で/.test(title)?true:null,ageRestricted:false,
   evidence:{checkedFrom:'official_public_jsonp',campaignId:r.campaign_id,publishedAt:p.published_date,listingUntil:p.close_date,period:p,metadataPriority:3}
  } as CampaignInput;
 });
}
export async function collectAdditionalSource(id:string,now:Date,read:(url:string,options?:{method?:string;body?:string})=>Promise<string>){
 const source=ADDITIONAL_SOURCES.find(s=>s.id===id);if(!source)throw new Error('公式収集元が見つかりません');
 const pages=source.pages||[source.dataUrl||source.url];const records:CampaignInput[]=[];let validPages=0,lastError:unknown;
 for(const url of pages){const raw=await read(url,{method:source.method,body:source.body});try{records.push(...(source.kind==='press'?revalidatePress(source,url,raw,now):parseAdditionalSource(id,raw,now,url)));validPages++;}catch(e){lastError=e;}}
 if(!validPages)throw lastError||new Error('公式収集元を確認できませんでした');return [...new Map(records.map(c=>[c.sourceKey,c])).values()];
}
export function revalidatePress(source:IndexSource,url:string,raw:string,now=new Date()):CampaignInput[]{
 const $=load(raw),body=$('#press-release-body');if(!body.length)throw new Error('主催者公式発表の本文を確認できませんでした');const text=textWithAlt($,body);
 if(closed.test(text)||!/抽選|当たる|あたる|プレゼント|贈呈|進呈/.test(text))return [];
 return SNAPSHOT_RECORDS.filter(c=>c.sourceId===source.id&&(!c.evidence.listedPeriodEnd||new Date(String(c.evidence.listedPeriodEnd))>now)&&canonicalCampaignUrl(c.sourceUrl)===canonicalCampaignUrl(url)&&(!c.deadline||new Date(c.deadline)>now)&&(!c.startsAt||new Date(c.startsAt)<=now)).map(c=>({...c,evidence:{...c.evidence,checkedFrom:'organizer_release_body_revalidated',metadataPriority:source.metadataPriority??2}}));
}
export function parseAdditionalSource(id:string,raw:string,now=new Date(),pageUrl?:string){
 const dynamic=DYNAMIC_INDEXES.find(s=>s.id===id);if(dynamic)return parseOfficialIndex(dynamic,raw,now);
 const source=SNAPSHOT_SOURCES.find(s=>s.id===id);if(!source)throw new Error('公式収集元が見つかりません');return revalidateSnapshot(source,raw,now,pageUrl);
}
