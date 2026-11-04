import { ADDITIONAL_SOURCES,ADDITIONAL_IMAGE_HOSTS,collectAdditionalSource } from './official-indexes';
import { load } from 'cheerio/slim';
import { clean,normalize,safeUrl,parseJSONP,jstTime,dateFromJapanese,classify,winners,inferMethods,officialImage as coreOfficialImage,type CampaignInput } from './campaign-core';
export * from './campaign-core';
export function officialImage(raw:unknown,base:string){return coreOfficialImage(raw,base,ADDITIONAL_IMAGE_HOSTS);}
export const SOURCES=[{id:'kirin',name:'キリン',url:'https://www.kirin.co.jp/campaign/alcohol/',dataUrl:'https://campaign.kirin.co.jp/campaign/json/campaign.json'},{id:'family',name:'ファミリーマート',url:'https://www.family.co.jp/campaign.html'},{id:'panasonic',name:'パナソニック',url:'https://panasonic.jp/membership/guide/campaign.html'},{id:'quo',name:'QUOカード公式',url:'https://www.quocard.com/individual/campaign/'},{id:'starbucks',name:'スターバックス',url:'https://stories.starbucks.co.jp/press/2026/pr-2026-1027/'},...ADDITIONAL_SOURCES.map(s=>({id:s.id,name:s.name,url:s.url}))];
export function parseKirin(raw:string,now=new Date()):CampaignInput[]{const rows=parseJSONP(raw);if(!Array.isArray(rows)||rows.length<1)throw new Error('公式データの形式が変わりました');return rows.filter(r=>r.kcSite&&jstTime(r.start)&&jstTime(r.end)&&new Date(jstTime(r.start)!)<=now&&new Date(jstTime(r.end)!)>now).map(r=>{const title=clean(r.title),summary=clean([r.read,r.attention].filter(Boolean).join(' ')),text=title+' '+summary;let methods=inferMethods(text);if(r.tw&&!methods.includes('X'))methods.push('X');if(r.ig&&!methods.includes('Instagram'))methods.push('Instagram');if(r.hagaki)methods.push('はがき');const classified=classify(text);const officialUrl=safeUrl(r.link,'https://www.kirin.co.jp/');return {sourceId:'kirin',sourceKey:'kirin:'+String(r.image).split('/').at(-1),title,brand:'キリン',officialUrl,sourceUrl:SOURCES[0].url,summary,imageUrl:r.Copyprotection===true?null:officialImage(r.image,SOURCES[0].url),imageSourceUrl:SOURCES[0].url,...classified,methods,deadline:jstTime(r.end),startsAt:jstTime(r.start),winners:winners(text),free:r.konyu===true?false:r.imasugu===true?true:null,noRegistration:null,daily:/1日1回|毎日応募/.test(text)?true:null,instant:/その場で/.test(text)?true:null,ageRestricted:!!r.over20,evidence:{start:r.start,end:r.end,konyu:r.konyu,imasugu:r.imasugu,checkedFrom:'official_public_index',imageRestricted:r.Copyprotection===true}};});}
export function parseFamily(raw:string,now=new Date()):CampaignInput[]{const $=load(raw),cards=$('.ly-mod-infoset5');if(!cards.length)throw new Error('公式一覧の構造が変わりました');const result:CampaignInput[]=[];cards.each((_,el)=>{const card=$(el);let meta:any;try{meta=JSON.parse(card.find('input[name="metaData"]').attr('value')??'{}');}catch{return;}if(meta.termKind==='ended')return;const title=clean(card.find('.ly-mod-infoset5-ttl').text()),summary=clean(card.find('.ly-mod-infoset5-txt').text()),term=clean(card.find('.ly-mod-infoset5-notes').text());if(/予告/.test(title)||!/当たる|抽選|プレゼント|もらえる|無料クーポン|大感謝祭/.test(title+' '+summary)||(/割引|円引|還元/.test(title)&&!/抽選|当たる|プレゼント/.test(title)))return;const href=card.find('a.ly-mod-infoset5-link').attr('href');if(!href)return;const officialUrl=safeUrl(href,SOURCES[1].url);if(new URL(officialUrl).hostname!=='www.family.co.jp')return;const deadline=dateFromJapanese(term,now);if(deadline&&new Date(deadline)<=now)return;const text=title+' '+summary;result.push({sourceId:'family',sourceKey:'family:'+new URL(officialUrl).pathname,title,brand:'ファミリーマート',officialUrl,sourceUrl:SOURCES[1].url,summary,imageUrl:officialImage(card.find('img').first().attr('src'),SOURCES[1].url),imageSourceUrl:SOURCES[1].url,...classify(text),methods:inferMethods(text),deadline,startsAt:null,winners:winners(text),free:/購入不要/.test(text)?true:/購入|買って|買うと|お買い物/.test(text)?false:null,noRegistration:/会員登録不要/.test(text)?true:null,daily:/1日1回/.test(text)?true:null,instant:/その場/.test(text)?true:null,ageRestricted:/20歳以上|満20歳|20才以上/.test(text),evidence:{period:term,category:meta.campaignCategory}});});return result;}
export function parsePanasonic(raw:string,now=new Date()):CampaignInput[]{const $=load(raw);const result:CampaignInput[]=[];const seen=new Set<string>();$('.c-lay011').each((_,el)=>{const section=$(el),text=clean(section.text());if(!text||text.length>1600||!/プレゼント|抽選|当たる/.test(text))return;const href=section.find('a[href]').first().attr('href');if(!href)return;let officialUrl;try{officialUrl=safeUrl(href,'https://panasonic.jp/membership/guide/campaign.html');}catch{return;}if(!['panasonic.jp','club.panasonic.jp'].includes(new URL(officialUrl).hostname)||seen.has(officialUrl))return;seen.add(officialUrl);const title=text.replace(/^毎月開催\s*/, '').replace(/\s*詳しく見る.*$/,'').slice(0,180);result.push({sourceId:'panasonic',sourceKey:'panasonic:'+new URL(officialUrl).pathname,title,brand:'パナソニック',officialUrl,sourceUrl:SOURCES[2].url,imageUrl:officialImage(section.find('img.cmp-image__image').first().attr('src'),SOURCES[2].url),imageSourceUrl:SOURCES[2].url,summary:'応募条件・賞品の詳細は、主催者の公式ページでご確認ください。',category:/コイン|ポイント/.test(title)?'金券':'その他',tags:/コイン/.test(title)?['コイン','クイズ']:[],methods:inferMethods(title),deadline:null,startsAt:null,winners:winners(title),free:null,noRegistration:false,daily:null,instant:null,ageRestricted:false,evidence:{checkedFrom:'official_index',periodRequiresConfirmation:true}});});if(!result.length)throw new Error('掲載対象を確認できませんでした');return result;}
export function matchesWish(c:any,term:string){return normalize([c.title,c.brand,c.summary,c.category,...(Array.isArray(c.tags)?c.tags:JSON.parse(c.tags||'[]'))].join(' ')).replace(/スタバ/g,'スターバックス').includes(normalize(term).replace(/スタバ/g,'スターバックス'));}
export async function fetchSource(url:string,options:{method?:string;body?:string}={}){const r=await fetch(url,{headers:{'user-agent':'HOSHII/1.0 (official campaign directory; low-frequency refresh)','accept':'text/html,application/json;q=0.9',...(options.body?{'content-type':'application/x-www-form-urlencoded'}:{})},method:options.method||'GET',body:options.body,redirect:'follow',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`公式サイト HTTP ${r.status}`);const bytes=await r.arrayBuffer();if(bytes.byteLength>3_000_000)throw new Error('公式データが大きすぎます');try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('shift_jis').decode(bytes);}}
export async function collectSource(id:string,now=new Date()){const source=SOURCES.find(s=>s.id===id)!;if(ADDITIONAL_SOURCES.some(s=>s.id===id))return collectAdditionalSource(id,now,fetchSource);const raw=await fetchSource(source.dataUrl||source.url);if(id==='starbucks'){const bingo=await fetchSource(STARBUCKS_BINGO_URL);return [...parseStarbucksBingo(bingo,now),...parseStarbucks(raw,now)];}return id==='kirin'?parseKirin(raw,now):id==='family'?parseFamily(raw,now):id==='panasonic'?parsePanasonic(raw,now):id==='quo'?parseQuo(raw,now):parseStarbucks(raw,now);}

// Dates below were checked against the organizer's terms, rather than inferred
// from an image filename or the date on which the issuer listed the campaign.
const QUO_FACTS:Record<string,{brand:string;deadline:string;summary?:string;winners?:number;free?:boolean;methods?:string[]}>= {
 'https://kotetchan2026aw.campar.jp/':{brand:'エスフーズ',deadline:'2027-01-31T23:59:00+09:00',free:false},
 'https://agf.ajinomoto.co.jp/feature/collectionrally_2026/':{brand:'味の素AGF',deadline:'2027-01-22T23:59:00+09:00',summary:'対象商品を購入し、バーコード・レシートをLINEから登録。購入・アップロードは2027年1月14日まで、抽選への応募は1月22日23:59まで。QUOカードPay 500円分などが当たります。',free:false,methods:['LINE']},
 'https://apz2026cp.com/':{brand:'SKWイーストアジア',deadline:'2027-03-31T23:59:00+09:00',summary:'対象商品購入コース：QUOカードPay 5,000円分50名・1,000円分300名。別に購入不要のアンケートコースもあります。',free:false},
 'https://www.sugi-net.jp/sugi-channel/4985':{brand:'スギ薬局',deadline:'2026-11-30T23:59:00+09:00',summary:'LINE公式アカウントの友だち追加とアプリ会員番号でエントリー。スギ薬局グループ専用QUOカードPay 5,000円50名・3,000円70名・500円80名。利用店舗が限定されます。',winners:200,free:true,methods:['LINE','アプリ']},
};
export function parseQuo(raw:string,now=new Date()):CampaignInput[]{
 const $=load(raw),cards=$('.campaigns_item');if(!cards.length)throw new Error('QUOカード公式一覧の構造が変わりました');
 const result:CampaignInput[]=[],seen=new Set<string>();
 cards.each((_,el)=>{
  const card=$(el),title=clean(card.find('.campaigns_title').text()),labels=card.find('.campaigns_label').toArray().map(el=>clean($(el).text()));
  if(!/当たる|あたる|抽選/.test(title)||/終了しました|終了済み/.test(title))return;
  const href=card.find('a.campaigns_itemInner').attr('href');if(!href)return;
  let officialUrl:string;try{officialUrl=safeUrl(href,SOURCES[3].url);}catch{return;}
  if(seen.has(officialUrl))return;seen.add(officialUrl);
  const known=QUO_FACTS[officialUrl],deadline=known?jstTime(known.deadline):null;
  if(deadline&&new Date(deadline)<=now)return;
  const text=title+' '+labels.join(' '),brand=known?.brand||(title.includes('｜')?title.split('｜')[0]:'QUOカード公式掲載');
  result.push({sourceId:'quo',sourceKey:'quo:'+officialUrl,title,brand,officialUrl,sourceUrl:SOURCES[3].url,
   imageUrl:officialImage(card.find('.campaigns_img img').attr('src'),SOURCES[3].url),imageSourceUrl:SOURCES[3].url,
   summary:known?.summary||('QUOカード発行元の公式一覧に掲載。'+(labels.length?'応募条件：'+labels.join('・')+'。':'')+'利用先や対象者の制限、応募期限は主催者のページでご確認ください。'),
   category:'金券',tags:['金券','ギフト券','QUOカードPay',...labels],methods:known?.methods||(labels.includes('SNS')&&!/LINE|Twitter|リポスト|Instagram/.test(text)?['公式で確認']:inferMethods(text)),deadline,startsAt:null,winners:known?.winners??winners(title),
   free:known?.free??(labels.includes('商品購入')?false:null),noRegistration:labels.includes('会員登録')?false:null,daily:null,instant:/その場/.test(title)?true:null,ageRestricted:/日本酒|ビール|酒造/.test(title),
   evidence:{checkedFrom:'official_issuer_index',labels,periodRequiresConfirmation:!deadline,termsUrl:known?officialUrl:null}
  });
 });return result.reverse();
}
export function parseStarbucks(raw:string,now=new Date()):CampaignInput[]{
 const $=load(raw);$('script,style,nav,footer').remove();
 const text=clean($('body').text()),section=text.split('グリーティングカードを贈って')[1]?.split('新商品発売を記念')[0];
 if(!section||!/eGift/.test(section))throw new Error('スターバックス公式の応募概要を確認できませんでした');
 if(/本キャンペーンは終了|キャンペーンは終了しました/.test(section))return [];
 const range=section.match(/20\d{2}年\d{1,2}月\d{1,2}日[^～~]*[～~]\s*(?:20\d{2}年)?\d{1,2}月\d{1,2}日(?:[（(][^）)]*[）)])?(?:\s*\d{1,2}:\d{2})?/);
 if(!range)throw new Error('スターバックス公式の応募期間が変わりました');
 const deadline=dateFromJapanese(range[0],now),startsAt=dateFromJapanese(range[0].split(/[～~]/)[0],now);
 if(!deadline||!startsAt)throw new Error('応募期間を読み取れませんでした');
 if(new Date(deadline)<=now||new Date(startsAt)>now)return [];
 const amount=section.match(/eGift[^\d]{0,12}([\d,]+)円分/),count=winners(section);
 if(!amount||!count)throw new Error('公式の賞品・当選人数が変わりました');
 const source=SOURCES[4],officialUrl='https://enjoystarbuckschilled.jp/merryberrychocolatelatte.html#linecp';
 const image=$('img').toArray().map(el=>$(el).attr('src')).find(src=>src?.includes('pr-2026-1027-3'));
 return [{sourceId:source.id,sourceKey:'starbucks:santa-2026',title:`スターバックス eGift ${amount[1]}円分が${count.toLocaleString('en-US')}名様に当たる｜大切な誰かのサンタになろう2026`,brand:'スターバックス',officialUrl,sourceUrl:source.url,
  imageUrl:officialImage(image,source.url),imageSourceUrl:source.url,summary:'LINE公式アカウントを友だち追加し、グリーティングカードを作って送ると、受け取った相手がその場で抽選の対象に。スターバックスのカフェで使えるドリンクチケットです。送った本人へのプレゼントではありません。',
  category:'金券',tags:['スタバ','スターバックス','eGift','ギフト券','金券','コーヒー'],methods:['LINE'],deadline,startsAt,winners:count,free:null,noRegistration:false,daily:null,instant:true,ageRestricted:false,evidence:{checkedFrom:'official_press_release',metadataPriority:3,period:range[0],recipientIsEntrant:true}
 }];
}
export const STARBUCKS_BINGO_URL='https://stories.starbucks.co.jp/press/2026/pr-2026-1026-2/';
export function parseStarbucksBingo(raw:string,now=new Date()):CampaignInput[]{
 const $=load(raw);$('script,style,nav,footer').remove();const text=clean($('body').text());
 const overview=text.split('キャンペーン概要')[1]?.split('スターバックス® リワードについて')[0];
 if(!overview||!/Holiday Bingo Party/.test(overview))throw new Error('スターバックス公式のビンゴ概要が変わりました');
 const period=overview.match(/実施期間[:：]?\s*(20\d{2}年\d{1,2}月\d{1,2}日[^～]*～\s*(?:20\d{2}年)?\d{1,2}月\d{1,2}日)/)?.[1];
 const draw=overview.match(/eTicket\s*([\d,]+)円分.*?抽選で\s*([\d,]+)名.*?抽選参加は\s*(\d{1,2}月\d{1,2}日)/);
 if(!period||!draw)throw new Error('スターバックス公式のビンゴ期間・賞品を確認できませんでした');
 const year=period.slice(0,5),deadline=dateFromJapanese(year+draw[3],now),startsAt=dateFromJapanese(period.split('～')[0],now);
 if(!deadline||!startsAt)throw new Error('ビンゴの応募期間を確認できませんでした');
 if(new Date(deadline)<=now||new Date(startsAt)>now)return [];
 const officialUrl=$('a[href]').toArray().map(el=>$(el).attr('href')).find(href=>href?.includes('/rewards/bingo_party2026_guest/'));
 if(!officialUrl)throw new Error('公式の応募先が変わりました');
 const image=$('img').toArray().map(el=>$(el).attr('src')).find(src=>src?.includes('pr-2026-1026-2-featured-image'));
 return [{sourceId:'starbucks',sourceKey:'starbucks:holiday-bingo-2026',title:`スタバのホリデーパーティーチケット ${draw[1]}円分が${draw[2]}名様に当たる`,brand:'スターバックス',officialUrl:safeUrl(officialUrl,STARBUCKS_BINGO_URL),sourceUrl:STARBUCKS_BINGO_URL,
  imageUrl:officialImage(image,STARBUCKS_BINGO_URL),imageSourceUrl:STARBUCKS_BINGO_URL,summary:'スターバックス リワード会員が対象。3ビンゴ・フルビンゴ達成ごとに抽選にエントリー。初回のビンゴ挑戦は購入不要、2回目以降は対象商品の購入が必要です。ビンゴの実施は12月25日まで、抽選参加は12月27日まで。',
  category:'金券',tags:['スタバ','スターバックス','eTicket','ギフト券','金券','コーヒー'],methods:['アプリ'],deadline,startsAt,winners:Number(draw[2].replaceAll(',','')),free:false,noRegistration:false,daily:null,instant:null,ageRestricted:false,evidence:{checkedFrom:'official_press_release',metadataPriority:3,period,drawDeadline:draw[3]}
 }];
}
