import { entryConditions, isOpenEntry, conditionCounts, ENTRY_POLICY, reviewedDeadline, reviewedSummary } from './entry-conditions';
import { campaignIdentity } from './catalog-identity';
import { ADDITIONAL_SOURCES } from './official-indexes';
import { collectSource, matchesWish, normalize, SOURCES, type CampaignInput } from './campaigns';
import { deliverPending, type PushEnv } from './push';
export const nowISO=()=>new Date().toISOString();
const flag=(v:boolean|null)=>v===null?null:v?1:0;
async function runBatches(db:D1Database,statements:D1PreparedStatement[]){const results:D1Result[]=[];for(let i=0;i<statements.length;i+=40)results.push(...await db.batch(statements.slice(i,i+40)));return results;}
export async function ingest(db:D1Database,items:CampaignInput[],at=nowISO(),policy:'all'|'open_new'='all'){
 const old=(await db.prepare('SELECT id,source_key,canonical_key,official_url,title,deadline,winners,evidence FROM campaigns').all<any>()).results;
 const byKey=new Map(old.map(c=>[c.source_key,c])),byIdentity=new Map<string,any>();
 const repairs:D1PreparedStatement[]=[];
 for(const c of old){const key=c.canonical_key||campaignIdentity({officialUrl:c.official_url,title:c.title,deadline:c.deadline});byIdentity.set(key,c);if(!c.canonical_key)repairs.push(db.prepare('UPDATE campaigns SET canonical_key=? WHERE id=?').bind(key,c.id));}
 await runBatches(db,repairs);
 const candidates=[...new Map(items.map(c=>[campaignIdentity(c),c])).entries()];
 const unique=candidates.filter(([key,c])=>policy==='all'||byKey.has(c.sourceKey)||byIdentity.has(key)||isOpenEntry(c));
 const skipped=candidates.length-unique.length;
 const insertItems=unique.filter(([key,c])=>!byKey.has(c.sourceKey)&&!byIdentity.has(key));
 const inserts=insertItems.map(([key,c])=>db.prepare('INSERT INTO campaigns (source_id,source_key,canonical_key,title,brand,official_url,source_url,summary,category,methods,tags,deadline,starts_at,winners,purchase_free,no_registration,daily,instant,age_restricted,first_seen,last_seen,checked_at,evidence,image_url,image_source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_key) DO NOTHING RETURNING id').bind(c.sourceId,c.sourceKey,key,c.title,c.brand,c.officialUrl,c.sourceUrl,c.summary,c.category,JSON.stringify(c.methods),JSON.stringify(c.tags),c.deadline,c.startsAt,c.winners,flag(c.free),flag(c.noRegistration),flag(c.daily),flag(c.instant),c.ageRestricted?1:0,at,at,at,JSON.stringify(c.evidence),c.imageUrl??null,c.imageSourceUrl??null));
 const inserted=await runBatches(db,inserts),newIds:number[]=[];
 inserted.forEach((result,i)=>{const id=(result.results[0] as any)?.id;if(id){const [key,c]=insertItems[i];const row={id,deadline:c.deadline,winners:c.winners};byIdentity.set(key,row);byKey.set(c.sourceKey,row);newIds.push(id);}});
 const changes:D1PreparedStatement[]=[];
 for(const [key,c] of unique){const existing=byIdentity.get(key)||byKey.get(c.sourceKey);if(!existing)throw new Error('公式情報の保存結果を確認できませんでした');
  if(!newIds.includes(existing.id)){const oldPriority=Number(JSON.parse(existing.evidence||'{}').metadataPriority??1),newPriority=Number(c.evidence.metadataPriority??1);if(newPriority>=oldPriority)changes.push(db.prepare('UPDATE campaigns SET source_id=?,canonical_key=?,title=?,brand=?,official_url=?,source_url=?,summary=?,category=?,methods=?,tags=?,deadline=?,starts_at=?,winners=?,purchase_free=?,no_registration=?,daily=?,instant=?,age_restricted=?,last_seen=?,checked_at=?,evidence=?,image_url=?,image_source_url=?,active=1 WHERE id=?').bind(c.sourceId,key,c.title,c.brand,c.officialUrl,c.sourceUrl,c.summary,c.category,JSON.stringify(c.methods),JSON.stringify(c.tags),c.evidence.deadlinePrecision==='unconfirmed'?null:c.deadline??existing.deadline,c.startsAt,c.winners??existing.winners,flag(c.free),flag(c.noRegistration),flag(c.daily),flag(c.instant),c.ageRestricted?1:0,at,at,JSON.stringify(c.evidence),c.imageUrl??null,c.imageSourceUrl??null,existing.id));else changes.push(db.prepare('UPDATE campaigns SET last_seen=?,checked_at=?,active=1 WHERE id=?').bind(at,at,existing.id));}
  changes.push(db.prepare('INSERT INTO campaign_sources(source_id,source_key,campaign_id,active,last_seen) VALUES(?,?,?,1,?) ON CONFLICT(source_id,source_key) DO UPDATE SET campaign_id=excluded.campaign_id,active=1,last_seen=excluded.last_seen').bind(c.sourceId,c.sourceKey,existing.id,at));
 }
 await runBatches(db,changes);const eligibleIds=[...new Set(unique.map(([key,c])=>(byIdentity.get(key)||byKey.get(c.sourceKey)).id))] as number[];const noticeCount=await matchNew(db,eligibleIds,at);return {added:newIds.length,newIds,notifications:noticeCount,skipped};
}
export async function finishSource(db:D1Database,sourceId:string,at:string){
 await db.prepare('UPDATE campaign_sources SET active=0 WHERE source_id=? AND last_seen<?').bind(sourceId,at).run();
 await db.prepare('UPDATE campaigns SET active=CASE WHEN EXISTS(SELECT 1 FROM campaign_sources s WHERE s.campaign_id=campaigns.id AND s.active=1) THEN 1 ELSE 0 END').run();
}
export async function matchNew(db:D1Database,ids:number[],at=nowISO()){
 if(!ids.length)return 0;const wishes=(await db.prepare('SELECT * FROM wishes WHERE notify=1').all<any>()).results;if(!wishes.length)return 0;
 const rows:any[]=[];for(let i=0;i<ids.length;i+=40){const chunk=ids.slice(i,i+40);rows.push(...(await db.prepare('SELECT * FROM campaigns WHERE id IN ('+chunk.map(()=>'?').join(',')+')').bind(...chunk).all<any>()).results);}
 const inserts:D1PreparedStatement[]=[];for(const c of rows)for(const w of wishes)if(isOpenEntry(c)&&matchesWish(c,w.term))inserts.push(db.prepare("INSERT INTO notifications(id,user_id,campaign_id,wish_id,term,kind,created_at,push_status) VALUES(?,?,?,?,?,'new',?,'pending') ON CONFLICT DO NOTHING").bind(crypto.randomUUID(),w.user_id,c.id,w.id,w.term,at));
 return (await runBatches(db,inserts)).reduce((n,r)=>n+Number(r.meta.changes||0),0);
}
export async function addWish(db:D1Database,userId:string,term:string,notify:boolean){const id=crypto.randomUUID(),at=nowISO(),normal=normalize(term);if(normal.length<1||normal.length>50)throw new Error('キーワードは1〜50文字で入力してください');await db.prepare('INSERT INTO wishes(id,user_id,term,normalized,notify,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,normalized) DO UPDATE SET notify=excluded.notify').bind(id,userId,term.trim(),normal,notify?1:0,at).run();const w=await db.prepare('SELECT * FROM wishes WHERE user_id=? AND normalized=?').bind(userId,normal).first<any>();let count=0;if(notify){const rows=await activeCampaigns(db);for(const c of rows){if(isOpenEntry(c)&&matchesWish(c,w.term)){const r=await db.prepare("INSERT INTO notifications(id,user_id,campaign_id,wish_id,term,kind,created_at,push_status) VALUES(?,?,?,?,?,'existing',?,'not_applicable') ON CONFLICT DO NOTHING").bind(crypto.randomUUID(),userId,c.id,w.id,w.term,at).run();count+=r.meta.changes;}}}return {id:w.id,matches:count};}
export async function activeCampaigns(db:D1Database){const at=nowISO();const rows=(await db.prepare('SELECT * FROM campaigns WHERE active=1 AND last_seen>? ORDER BY first_seen DESC,id DESC LIMIT 5000').bind(new Date(Date.now()-172800000).toISOString()).all<any>()).results;return rows.map(c=>({...c,deadline:reviewedDeadline(c)||c.deadline})).filter(c=>!c.deadline||c.deadline>at);}
export function toClient(c:any){c={...c,deadline:reviewedDeadline(c)||c.deadline};const entry=entryConditions(c);const days=c.deadline?Math.max(0,Math.ceil((new Date(c.deadline).getTime()-Date.now())/86400000)):null;const cats:any={'家電':['appliance','#e6e8f0'],'食品':['coffee','#eee2d6'],'旅行':['travel','#dfe9e5'],'金券':['gift','#efe9d5'],'美容':['beauty','#f0e1df'],'日用品':['bag','#e3e4db'],'その他':['gift','#e7e8df']};return {entryConditions:entry,id:c.id,title:c.title,brand:c.brand,category:c.category,art:cats[c.category]?.[0]||'gift',bg:cats[c.category]?.[1]||'#e7e8df',winners:c.winners,days,method:JSON.parse(c.methods)[0]||'公式で確認',methods:JSON.parse(c.methods),tags:JSON.parse(c.tags),free:entry.purchaseFree,noRegistration:c.no_registration===null?null:!!c.no_registration,daily:c.daily===null?null:!!c.daily,instant:c.instant===null?null:!!c.instant,deadline:c.deadline?new Date(c.deadline).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}):null,deadlineAt:c.deadline,officialUrl:c.official_url,sourceUrl:c.source_url,imageUrl:c.image_url||null,imageSourceUrl:c.image_source_url||null,sourceId:c.source_id,summary:reviewedSummary(c)||c.summary,ageRestricted:!!c.age_restricted,firstSeen:c.first_seen,checkedAt:c.checked_at,popularity:c.clicks};}
export async function bootstrap(env:PushEnv,userId:string){const all=await env.DB.batch([env.DB.prepare('SELECT * FROM wishes WHERE user_id=? ORDER BY created_at').bind(userId),env.DB.prepare('SELECT campaign_id FROM bookmarks WHERE user_id=?').bind(userId),env.DB.prepare('SELECT campaign_id FROM applications WHERE user_id=?').bind(userId),env.DB.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(userId),env.DB.prepare('SELECT c.* FROM campaigns c WHERE c.id IN (SELECT campaign_id FROM bookmarks WHERE user_id=? UNION SELECT campaign_id FROM applications WHERE user_id=? UNION SELECT campaign_id FROM notifications WHERE user_id=?)').bind(userId,userId,userId),env.DB.prepare('SELECT s.* FROM sync_runs s WHERE started_at=(SELECT MAX(started_at) FROM sync_runs x WHERE x.source_id=s.source_id)'),env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id=?').bind(userId)]);const active=await activeCampaigns(env.DB);const byId=new Map([...all[4].results,...active].map((c:any)=>[c.id,c]));return {entryPolicy:ENTRY_POLICY,conditionCounts:conditionCounts(active),campaigns:[...byId.values()].map(toClient),activeIds:active.map(c=>c.id),wishes:all[0].results.map((w:any)=>({id:w.id,term:w.term,notify:!!w.notify})),saved:all[1].results.map((x:any)=>x.campaign_id),applied:all[2].results.map((x:any)=>x.campaign_id),notifications:all[3].results.map((n:any)=>({id:n.id,campaign:n.campaign_id,term:n.term,kind:n.kind,createdAt:n.created_at,read:!!n.read_at,pushStatus:n.push_status})),sources:SOURCES.map(s=>({...s,lastRun:all[5].results.find((r:any)=>r.source_id===s.id)||null})),push:{configured:!!env.VAPID_PUBLIC_KEY&&!!env.VAPID_PRIVATE_KEY,publicKey:env.VAPID_PUBLIC_KEY||null,devices:(all[6].results[0] as any).count},serverTime:nowISO()};}
export async function refresh(env:PushEnv,options:{cursor?:number;limit?:number}={}){
 const cursor=Math.max(0,Math.min(SOURCES.length,Math.trunc(options.cursor||0))),limit=Math.max(1,Math.min(4,Math.trunc(options.limit||4)));
 const batch:typeof SOURCES=[];let requests=0;
 for(const source of SOURCES.slice(cursor,cursor+limit)){const config=ADDITIONAL_SOURCES.find(s=>s.id===source.id),cost=config?.pages?.length||1;if(batch.length&&requests+cost>24)break;batch.push(source);requests+=cost;}
 const nextCursor=cursor+batch.length<SOURCES.length?cursor+batch.length:null;
 const db=env.DB,token=crypto.randomUUID(),start=nowISO();
 const lock=await db.prepare("INSERT INTO leases(name,token,expires_at) VALUES('refresh',?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE leases.expires_at<? RETURNING token").bind(token,Date.now()+900000,Date.now()).first<any>();
 if(!lock)return {busy:true,cursor,nextCursor:cursor,complete:false};
 const results:any[]=[];
 try{
  const collected=await Promise.allSettled(batch.map(source=>collectSource(source.id)));
  for(let i=0;i<batch.length;i++){
   const source=batch[i],at=nowISO();
   try{
    const collection=collected[i];if(collection.status==='rejected')throw collection.reason;
    const items=collection.value,result=await ingest(db,items,at,'open_new');await finishSource(db,source.id,at);
    await db.prepare('INSERT INTO sync_runs(id,source_id,started_at,finished_at,status,count) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),source.id,at,nowISO(),'ok',items.length).run();
    results.push({source:source.id,status:'ok',found:items.length,...result});
   }catch(e){
    const error=e instanceof Error?e.message:'取得に失敗しました';
    await db.prepare('INSERT INTO sync_runs(id,source_id,started_at,finished_at,status,error) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),source.id,at,nowISO(),'error',error.slice(0,300)).run();
    results.push({source:source.id,status:'error',error});
   }
  }
  const push=await deliverPending(env);await db.prepare('DELETE FROM sync_runs WHERE started_at<?').bind(new Date(Date.now()-30*86400000).toISOString()).run();
  return {startedAt:start,finishedAt:nowISO(),cursor,nextCursor,complete:nextCursor===null,sourceCount:SOURCES.length,sources:results,push};
 }finally{await db.prepare("DELETE FROM leases WHERE name='refresh' AND token=?").bind(token).run();}
}
