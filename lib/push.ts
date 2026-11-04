import { buildPushPayload } from '@block65/webcrypto-web-push';
export type PushEnv={VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string;DB:D1Database};
export function validSubscription(s:any){try{const u=new URL(s.endpoint);const host=u.hostname;return u.protocol==='https:'&&(/(^|\.)push\.services\.mozilla\.com$|(^|\.)fcm\.googleapis\.com$|(^|\.)web\.push\.apple\.com$|(^|\.)notify\.windows\.com$|(^|\.)push\.microsoft\.com$/.test(host))&&typeof s.keys?.p256dh==='string'&&typeof s.keys?.auth==='string'&&s.endpoint.length<2048;}catch{return false;}}
export async function sendPush(env:PushEnv,subscription:any,payload:unknown){if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)throw new Error('ブラウザ通知の配信設定がありません');if(!validSubscription(subscription))throw new Error('通知先が正しくありません');const req=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:3600}},subscription,{subject:env.VAPID_SUBJECT||'https://hoshii-giveaway-dashboard.yuuma-okamori015710.chatgpt.site',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});const r=await fetch(subscription.endpoint,{...req,redirect:'error',signal:AbortSignal.timeout(12000)});return {ok:r.ok,status:r.status};}
export async function deliverPending(env:PushEnv){
 if(!env.VAPID_PRIVATE_KEY)return {sent:0,failed:0};
 const notices=await env.DB.prepare("SELECT n.*,c.title FROM notifications n JOIN campaigns c ON c.id=n.campaign_id JOIN wishes w ON w.id=n.wish_id AND w.notify=1 WHERE n.kind='new' AND n.read_at IS NULL AND n.push_status IN ('pending','retry') AND n.push_attempts<5 AND n.created_at>? AND c.active=1 AND (c.deadline IS NULL OR c.deadline>?) AND c.last_seen>? ORDER BY n.created_at LIMIT 30").bind(new Date(Date.now()-86400000).toISOString(),new Date().toISOString(),new Date(Date.now()-172800000).toISOString()).all<any>();
 let sent=0,failed=0;
 for(const n of notices.results){
  const subs=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id=?').bind(n.user_id).all<any>();
  if(!subs.results.length){await env.DB.prepare("UPDATE notifications SET push_status='no_subscription' WHERE id=?").bind(n.id).run();continue;}
  let success=false,retry=false;
  for(const row of subs.results){
   const previous=await env.DB.prepare('SELECT sent_at FROM push_deliveries WHERE notification_id=? AND endpoint=?').bind(n.id,row.endpoint).first();
   if(previous){success=true;continue;}
   try{
    const result=await sendPush(env,JSON.parse(row.subscription),{title:`欲しい「${n.term}」の懸賞が出ています`,body:n.title,url:'/#notifications',notificationId:n.id,tag:`hoshii-${n.id}`});
    if(result.ok){success=true;await env.DB.batch([env.DB.prepare('INSERT INTO push_deliveries(notification_id,endpoint,sent_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(n.id,row.endpoint,new Date().toISOString()),env.DB.prepare('UPDATE push_subscriptions SET last_success=? WHERE endpoint=?').bind(new Date().toISOString(),row.endpoint)]);}
    else if([404,410].includes(result.status))await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(row.endpoint).run();
    else retry=true;
   }catch{retry=true;}
  }
  await env.DB.prepare('UPDATE notifications SET push_status=?,push_attempts=push_attempts+1,push_attempt_at=? WHERE id=?').bind(retry?'retry':success?'sent':'expired',new Date().toISOString(),n.id).run();
  if(success)sent++;if(retry)failed++;
 }
 return {sent,failed};
}
