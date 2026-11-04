import reviews from './entry-reviews.json';
import { canonicalIdentityUrl } from './catalog-identity';

export type EntryStatus = 'open' | 'conditional' | 'unknown';
export type EntryRequirement = { id:string; label:string; detail:string; sourceUrl:string|null };
export type EntryConditions = { status:EntryStatus; label:string; requirements:EntryRequirement[]; steps:string[]; notes:string[]; purchaseFree:boolean|null; checkedAt:string|null; entryUrl:string|null };
export const ENTRY_POLICY = {
 revision:'entry-conditions-v1', defaultStatus:'open', newCollection:'verified_open_only', notifications:'verified_open_only',
 allowedSteps:['無料会員登録','SNSフォロー・リポスト','簡単なアンケート・クイズ'],
 excludedRequirements:['購入・レシート','有料会員・既存契約','来店・現地参加','地域・対象者限定','番組の応募番号','口座・決済実績','商品モニター・作品投稿'],
 unknownPolicy:'未確認は追加条件なしに含めない',
};
const array=(value:unknown):string[]=>{if(Array.isArray(value))return value.filter(x=>typeof x==='string');if(typeof value==='string'){try{return array(JSON.parse(value));}catch{return [value];}}return [];};
function object(value:any):Record<string,any>{if(value&&typeof value==='object'&&!Array.isArray(value))return value;if(typeof value==='string'){try{return object(JSON.parse(value));}catch{}}return {};}
const norm=(v:unknown)=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function values(value:unknown):string[]{if(typeof value==='string')return [norm(value)];if(Array.isArray(value))return value.flatMap(values);if(value&&typeof value==='object')return Object.values(value).flatMap(values);return [];}
function withoutNegations(text:string){return text.replace(/[^。！？]*(?:とは別|別の抽選|購入条件はありません|購入は必要ありません|口座開設(?:は|が)?不要|必須ではありません)[^。！？]*/g,' ').replace(/(?:商品)?購入(?:は|が)?(?:一切)?不要|購入しなくても(?:応募|参加)(?:可能|できます)?|(?:無料|有料)?会員登録(?:は|が)?不要|来店(?:は|が)?不要|契約(?:は|が)?不要|JAF会員でなくても[^。]{0,12}/g,' ');}
const reviewsByUrl=new Map<string,any[]>();
for(const review of reviews as any[]){const key=canonicalIdentityUrl(review.officialUrl);reviewsByUrl.set(key,[...(reviewsByUrl.get(key)||[]),review]);}
function reviewed(c:any){
 const url=c.officialUrl||c.official_url;if(!url)return null;
 try{return (reviewsByUrl.get(canonicalIdentityUrl(url))||[]).find(r=>r.sourceKey===(c.sourceKey||c.source_key)||r.sourceKeys?.includes(c.sourceKey||c.source_key)||norm(r.title)===norm(c.title))||null;}catch{return null;}
}
function entryLink(value:unknown){if(typeof value!=='string'||/[\[\]<>]|CONTEST_POST_ID|PLACEHOLDER/i.test(value))return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
export function reviewedDeadline(c:any):string|undefined{const correction=reviewed(c)?.deadlineCorrection;const value=typeof correction==='string'?correction:correction?.deadline;return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined;}
function excerpt(parts:string[],pattern:RegExp,fallback:string){
 const part=parts.find(p=>pattern.test(withoutNegations(p)));if(!part)return fallback;
 const sentence=part.split(/(?<=[。！!?？])\s*/).find(s=>pattern.test(withoutNegations(s)))||part;
 return sentence.length<=230?sentence:sentence.slice(Math.max(0,sentence.search(pattern)-45),Math.max(0,sentence.search(pattern)-45)+230)+'…';
}

/** "open" means no additional restrictive requirement, not automatic eligibility. */
export function entryConditions(c:any):EntryConditions{
 const evidence=object(c.evidence),review=reviewed(c),methods=array(c.methods),tags=array(c.tags);
 const parts=(review?values(review.status==='unknown'?[]:review.requirements):[...['conditions','purchaseRequirement','postingConditions','eligibility','requirements','entryRequirements','applicationRequirements','participantRestrictions','period','notes'].flatMap(k=>values(evidence[k])),norm(c.summary),norm(c.title)]).filter(Boolean);
 const text=parts.join(' '),requiredText=withoutNegations(text),sourceUrl=review?.sourceUrl||c.sourceUrl||c.source_url||c.officialUrl||c.official_url||null;
 const requirements:EntryRequirement[]=[],steps:string[]=array(review?.steps);
 const add=(id:string,label:string,pattern:RegExp)=>{if(pattern.test(requiredText))requirements.push({id,label,detail:excerpt(parts,pattern,label),sourceUrl});};
 const purchase=/レシート|対象商品.{0,24}(?:購入|お買い上げ|買って)|(?:購入|買うと|買って|お買い上げ|同時購入).{0,25}(?:応募|抽選|以上|必要)|(?:シリアルコード|応募シール|バーコード).{0,25}(?:必要|集め|応募)|商品を.{0,15}購入/;
 add('purchase','購入・レシートが必要',purchase);
 add('paid_membership','有料会員・契約者などが対象',/JAF会員|有料(?:会員|プラン|サービス)|(?:契約者|購読者|加入者)(?:限定|向け|が対象|の方)|J[:：]?COM.{0,20}(?:加入|契約)|(?:プライム|Prime)会員限定/);
 add('financial','口座・決済などの利用条件あり',/口座(?:を)?(?:お持ち|持つ|保有|開設)|口座開設|預金残高|決済.{0,28}(?:利用|合計|以上)|(?:出資|投資家).{0,12}(?:限定|対象|必要)|カードショッピング|保険.{0,8}契約|住宅ローン|カード.{0,15}(?:利用実績|利用金額|発行|会員限定)|口座が必要/);
 add('visit','来店・現地参加などが必要',/来店|来場|現地(?:で|参加|受取|引換)|(?:店舗|施設).{0,12}(?:訪問|引換)|スタンプラリー|スポットを巡|周遊|宿泊(?:利用|が必要|者限定)|事前予約|来場予約/);
 const geographic=requiredText.replace(/日本国内(?:在住|居住)|国内(?:在住|居住)/g,' ');
 const audience=/(?:在住|居住|在勤|在学).{0,15}(?:限定|対象|方)|(?:女性|男性|美容師|医師)限定|未使用者(?:限定|が対象)|(?:小学生|中学生|高校生|お子さま|幼児).{0,12}(?:対象|限定)/;
 if(audience.test(geographic))requirements.push({id:'audience',label:'地域・対象者の限定あり',detail:excerpt([geographic],audience,'対象地域・対象者を公式で確認してください。'),sourceUrl});
 add('viewing_code','番組の応募番号・キーワードが必要',/データ放送|(?:番組|放送).{0,45}(?:応募番号|応募キーワード|キーワード)|(?:応募番号|応募キーワード).{0,30}(?:視聴|放送)/);
 const reviewPattern=/商品モニター|体験モニター|モニター(?:募集|体験|報告|参加)|使用後.{0,20}(?:レビュー|感想|投稿)|レビュー.{0,15}(?:必須|必要|投稿|提出)|写真.{0,16}(?:投稿|報告|提出)|動画投稿|フォトコンテスト|(?:エピソード|作品).{0,15}(?:投稿|応募)|(?:顔出し|顔写真|広告掲載).{0,15}(?:条件|必要|同意|必須)/;
 add('creative','商品体験・レビュー・作品投稿が必要',reviewPattern);
 if(!review&&tags.some(t=>t==='モニター')&&!requirements.some(r=>r.id==='creative')&&!/ゲーミングモニター|液晶モニター|PCモニター/.test(text))requirements.push({id:'creative',label:'商品モニターの参加条件あり',detail:parts.find(p=>/モニター|レビュー|投稿/.test(p))||'使用・レビュー等の条件は公式ページでご確認ください。',sourceUrl});
 const explicitlyFree=/購入(?:は|が)?(?:一切)?不要|購入しなくても(?:応募|参加)|無料で(?:応募|参加)|誰でも(?:無料で)?応募/.test(text);
 const flag=c.free!==undefined?c.free:c.purchase_free===null||c.purchase_free===undefined?null:!!c.purchase_free;
 if(!review&&flag===false&&!explicitlyFree&&!requirements.length)requirements.push({id:'other',label:'購入・利用等の条件あり',detail:'追加条件のある企画です。具体的な対象商品・金額・利用資格は、掲載情報では確認できていません。公式ページでご確認ください。',sourceUrl});
 if(review?.status==='conditional'&&!requirements.length)for(const detail of review.requirements||[])requirements.push({id:'reviewed',label:norm(detail).slice(0,32),detail:norm(detail),sourceUrl});
 const noRegistration=c.noRegistration!==undefined?c.noRegistration:c.no_registration===null||c.no_registration===undefined?null:!!c.no_registration;
 if(/無料会員|無料登録|無料アカウント|会員登録.*無料/.test(text))steps.push('無料アカウント・会員登録');
 else if(!review&&noRegistration===false&&!requirements.some(r=>r.id==='paid_membership'))steps.push('会員登録・ログイン（料金・資格は公式で確認）');
 if(methods.some(m=>['X','Instagram'].includes(m))||/フォロー|リポスト|リツイート/.test(text))steps.push('SNSフォロー・リポストなど');
 if(methods.includes('LINE')||/LINE公式|LINE.*友だち/.test(text))steps.push('LINEの友だち追加・操作など');
 if(methods.includes('アンケート')||/アンケート|クイズ/.test(text))steps.push('アンケート・クイズへの回答');
 for(const step of review?.steps||[])if(!steps.includes(step))steps.push(step);
 if(!steps.length&&methods.some(m=>/Web/i.test(m)))steps.push('Webフォームで応募');
 if(c.ageRestricted||c.age_restricted)steps.push('年齢などの基本資格を公式ページで確認');
 // Purchase-free metadata alone does not establish that all eligibility terms are simple.
 const status:EntryStatus=requirements.length?'conditional':review?.status==='unknown'?'unknown':review?.status==='open'||evidence.entryConditionsVerified===true&&flag===true?'open':'unknown';
 const notes=review?.status==='unknown'?array(review.requirements):[];
 if(review?.catalogCorrection)for(const value of Object.values(review.catalogCorrection))if(typeof value==='string'&&!/^20\d{2}-|^expired$/.test(value))notes.push(value);
 if(status==='unknown')notes.push('購入不要と確認できていても、会員資格・利用実績などの追加条件は未確認です。');
 return {status,label:status==='open'?'追加条件なし':status==='conditional'?'条件付き':'追加条件は未確認',requirements,steps:[...new Set(steps)],notes,purchaseFree:requirements.some(r=>r.id==='purchase')?false:flag===true||explicitlyFree||review?.status==='open'?true:flag,checkedAt:review?.checkedAt||evidence.entryConditionsVerifiedAt||null,entryUrl:status==='open'?entryLink(review?.entryUrl||review?.entryPostUrl):null};
}

export const isOpenEntry=(c:any)=>entryConditions(c).status==='open'&&(!reviewedDeadline(c)||Date.parse(reviewedDeadline(c)!)>Date.now());
export function conditionCounts(campaigns:any[]){return campaigns.reduce((n,c)=>{n[entryConditions(c).status]++;return n;},{open:0,conditional:0,unknown:0});}
