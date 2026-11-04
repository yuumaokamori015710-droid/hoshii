import {entryConditions,isOpenEntry} from '../.sites-runtime/tests/entry-conditions.mjs';
import {load} from 'cheerio/slim';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createECDH,randomBytes} from 'node:crypto';
import {parseKirin,parseFamily,parseQuo,parseStarbucks,parseStarbucksBingo,officialImage,dateFromJapanese,matchesWish} from '../.sites-runtime/tests/campaigns.mjs';
import {ingest,addWish,bootstrap,finishSource} from '../.sites-runtime/tests/live-store.mjs';
import {canonicalCampaignUrl,campaignIdentity} from '../.sites-runtime/tests/catalog-identity.mjs';
import {parseOfficialIndex,parseDocomoIndex,revalidateSnapshot,SNAPSHOT_RECORDS,SNAPSHOT_SOURCES} from '../.sites-runtime/tests/official-indexes.mjs';
import {deliverPending,validSubscription,sendPush} from '../.sites-runtime/tests/push.mjs';
function database(){const sql=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));const db={prepare(query){let args=[];const command={bind(...a){args=a;return command;},async first(){return sql.prepare(query).get(...args)||null;},async all(){const results=sql.prepare(query).all(...args);return {results,meta:{changes:Number(sql.prepare('SELECT changes() AS n').get().n)}};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)},success:true};}};return command;},async batch(commands){const result=[];for(const c of commands){try{result.push(await c.all());}catch{result.push(await c.run());}}return result;}};return {sql,db};}
function campaign(key,title='コーヒーのプレゼント'){const at=new Date().toISOString();return {sourceId:'kirin',sourceKey:key,title,brand:'キリン',officialUrl:'https://www.kirin.co.jp/campaign/'+key+'/',sourceUrl:'https://www.kirin.co.jp/campaign/',summary:'コーヒーが当たるキャンペーン',category:'食品',methods:['Web'],tags:['コーヒー'],deadline:new Date(Date.now()+86400000).toISOString(),startsAt:at,winners:null,free:true,noRegistration:null,daily:null,instant:null,ageRestricted:false,imageUrl:'https://campaign.kirin.co.jp/campaign/images/example',imageSourceUrl:'https://www.kirin.co.jp/campaign/',evidence:{entryConditionsVerified:true}};}
function subscription(suffix='a'){const c=createECDH('prime256v1');c.generateKeys();return {endpoint:'https://fcm.googleapis.com/fcm/send/'+suffix,keys:{p256dh:c.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};}
function vapid(){const v=createECDH('prime256v1');v.generateKeys();return {VAPID_PUBLIC_KEY:v.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:v.getPrivateKey().toString('base64url'),VAPID_SUBJECT:'https://example.com'};}
test('公式URLの追跡値を除き、くじの必須ハッシュ経路と異なる応募IDを維持する',()=>{
 assert.equal(canonicalCampaignUrl('https://example.com/cp/?utm_source=a&id=2#apply'),'https://example.com/cp?id=2');
 assert.notEqual(canonicalCampaignUrl('https://lot.tsite.jp/#/detail2/123'),canonicalCampaignUrl('https://lot.tsite.jp/#/detail2/456'));
 assert.equal(canonicalCampaignUrl('https://lot.tsite.jp/#/detail2/123'),'https://lot.tsite.jp/#/detail2/123');
});
test('販売店と主催者の重複を一件にまとめ、片方の掲載終了で残る公式根拠を消さない',async()=>{
 const {sql,db}=database();await addWish(db,'alice','コーヒー',true);
 const first={...campaign('issuer'),evidence:{metadataPriority:3,entryConditionsVerified:true}},second={...campaign('retailer'),sourceId:'other',officialUrl:first.officialUrl+'?utm_source=other',deadline:null,evidence:{metadataPriority:1}};
 await ingest(db,[first],'2026-11-04T00:00:00.000Z');await ingest(db,[second],'2026-11-04T00:01:00.000Z');
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n,1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);assert.equal(sql.prepare('SELECT deadline FROM campaigns').get().deadline,first.deadline);
 await finishSource(db,'kirin','2026-11-04T00:02:00.000Z');assert.equal(sql.prepare('SELECT active FROM campaigns').get().active,1);
 await finishSource(db,'other','2026-11-04T00:03:00.000Z');assert.equal(sql.prepare('SELECT active FROM campaigns').get().active,0);
});
test('公式一覧の応募期間を使い、午前締切・未来開始・受付終了・抽選販売を区別する',()=>{
 const source={id:'fixture',name:'公式',url:'https://example.com/campaign/',selector:'article',title:'h2',period:'.period',requireDate:true};
 const card=(title,period,id)=>`<article><h2>${title}</h2><a href="/cp/${id}">応募</a><p class="period">${period}</p></article>`;
 const html=card('ギフトが当たる','応募締切：2026年11月4日（水）AM 09:59','current')+card('当たるキャンペーン','2026年11月5日～2026年11月30日','future')+card('プレゼント 受付終了','2026年11月30日','ended')+card('ウイスキー抽選販売','2026年11月30日','sale');
 const rows=parseOfficialIndex(source,html,new Date('2026-11-04T00:00:00Z'));assert.equal(rows.length,1);assert.equal(rows[0].deadline,'2026-11-04T00:59:00.000Z');assert.equal(parseOfficialIndex(source,html,new Date('2026-11-04T01:00:00Z')).length,0);
});
test('公式画像は公開元のHTTPSホストに限定し、転載保護フラグを尊重する',()=>{
 assert.equal(officialImage('//www.quocard.com/example.jpg','https://www.quocard.com/'),'https://www.quocard.com/example.jpg');
 for(const url of ['http://www.quocard.com/x','https://evil.test/x','data:image/svg+xml,x','https://user:pass@www.quocard.com/x'])assert.equal(officialImage(url,'https://www.quocard.com/'),null);
 const row={kcSite:true,title:'プレゼント',image:'https://campaign.kirin.co.jp/campaign/images/cms123',link:'https://www.kirin.co.jp/',start:'2026-11-01 00:00:00',end:'2026-11-30 23:59:00'};
 assert.equal(parseKirin(JSON.stringify([row]),new Date('2026-11-04'))[0].imageUrl,row.image);
 assert.equal(parseKirin(JSON.stringify([{...row,Copyprotection:true}]),new Date('2026-11-04'))[0].imageUrl,null);
});
test('金券公式一覧では重複・終了を除外し、未確認の締切やSNS方法は捏造しない',()=>{
 const card=(title,url)=>`<div class="campaigns_item"><a class="campaigns_itemInner" href="${url}"><span class="campaigns_label">SNS</span><figure class="campaigns_img"><img src="https://www.quocard.com/banner.jpg"></figure><p class="campaigns_title">${title}</p></a></div>`;
 const html=card('ギフトが100名様に当たる！','https://example.com/cp/?utm_source=quo')+card('ギフトが100名様に当たる！','https://example.com/cp/')+card('販売開始しました','https://example.com/shop/')+card('抽選終了しました','https://example.com/ended/');
 const rows=parseQuo(html,new Date('2026-11-04'));assert.equal(rows.length,1);assert.equal(rows[0].deadline,null);assert.equal(rows[0].free,null);assert.equal(rows[0].winners,100);assert.deepEqual(rows[0].methods,['公式で確認']);assert.equal(rows[0].imageSourceUrl,'https://www.quocard.com/individual/campaign/');
});
test('スタバギフトの受取対象、金額、JST締切とビンゴの別期限を保持する',()=>{
 const gift=`<body><h2>グリーティングカードを贈って</h2><p>eGift 500円分 合計1,000名様</p><p>2026年11月3日（火）10:00 ～2026年11月30日（月）23:59</p><img src="https://about.starbucks.com/uploads/pr-2026-1027-3.jpg"><h2>新商品発売を記念</h2></body>`;
 const [g]=parseStarbucks(gift,new Date('2026-11-04'));assert.equal(g.winners,1000);assert.equal(g.deadline,'2026-11-30T14:59:00.000Z');assert.equal(g.evidence.recipientIsEntrant,true);assert.equal(matchesWish(g,'スタバ'),true);assert.equal(parseStarbucks(gift,new Date('2026-12-01')).length,0);assert.equal(parseStarbucks(gift,new Date('2026-11-03T00:00:00Z')).length,0);assert.throws(()=>parseStarbucks('<body>構造変更</body>'));
 const bingo=`<body><h2>キャンペーン概要</h2><p>Holiday Bingo Party 実施期間：2026年11月2日（月）～12月25日（金）</p><p>eTicket 3,000円分 抽選で3,000名さま 抽選参加は12月27日（日）まで</p><a href="https://www.starbucks.co.jp/rewards/bingo_party2026_guest/">参加</a></body>`;
 const [b]=parseStarbucksBingo(bingo,new Date('2026-11-04'));assert.equal(b.deadline,'2026-12-27T14:59:00.000Z');assert.equal(b.free,false);assert.equal(b.winners,3000);assert.equal(b.category,'金券');assert.equal(parseStarbucksBingo(bingo,new Date('2026-12-28')).length,0);
});
test('公式JSONPは実行せず解析し、終了済みと未開始の情報を除外する',()=>{const base={kcSite:true,image:'https://example.com/cms123',title:'えらべるPay 5,000ポイントが777名様にその場で当たる',attention:'LINEで応募',link:'https://cp.kirin.jp/story/38378?utm_source=x',start:'2026-11-01 00:00:00',end:'2026-11-06 23:59:00',imasugu:true,konyu:false};const r=parseKirin('campaign('+JSON.stringify([base,{...base,end:'2026-11-02 23:59:00'},{...base,start:'2026-12-01 00:00:00'}])+')',new Date('2026-11-03T00:00:00Z'));assert.equal(r.length,1);assert.equal(r[0].deadline,'2026-11-06T14:59:00.000Z');assert.equal(r[0].free,true);assert.equal(r[0].winners,777);assert.equal(r[0].officialUrl,'https://cp.kirin.jp/story/38378');assert.deepEqual(r[0].methods,['LINE']);assert.throws(()=>parseKirin('globalThis.secret=1;'))});
test('公式HTMLから懸賞だけを抽出し、年をまたぐ締切と購入条件を保持する',()=>{const html=`<div class="ly-mod-infoset5"><input name="metaData" value='{"campaignCategory":"3","termKind":"ongoing"}'><a class="ly-mod-infoset5-link" href="https://www.family.co.jp/campaign/test.html"><h3 class="ly-mod-infoset5-ttl">買うと抽選でギフトが当たる</h3><p class="ly-mod-infoset5-txt">お酒は対象外です</p><p class="ly-mod-infoset5-notes">2026年11月1日〜2027年1月11日</p></a></div><div class="ly-mod-infoset5"><input name="metaData" value='{"campaignCategory":"1","termKind":"ongoing"}'><h3 class="ly-mod-infoset5-ttl">新商品セール</h3></div>`;const r=parseFamily(html,new Date('2026-11-03'));assert.equal(r.length,1);assert.equal(r[0].free,false);assert.equal(r[0].ageRestricted,false);assert.equal(r[0].deadline,'2027-01-11T14:59:00.000Z');assert.equal(dateFromJapanese('2026年12月1日〜1月5日',new Date('2026-11-03')),'2027-01-05T14:59:00.000Z');assert.equal(matchesWish({title:'ＣＯＦＦＥＥ キャンペーン',tags:[]},'coffee'),true)});
test('既存一致と新着を区別し、再収集・保存・別ユーザーで重複や混線を起こさない',async()=>{const {sql,db}=database();await ingest(db,[campaign('first')]);const first=await addWish(db,'alice','コーヒー',true);assert.equal(first.matches,1);await addWish(db,'bob','旅行',true);await ingest(db,[campaign('first'),campaign('second')]);await ingest(db,[campaign('second')]);const a=await bootstrap({DB:db},'alice'),b=await bootstrap({DB:db},'bob');assert.equal(a.notifications.length,2);assert.equal(a.notifications.filter(n=>n.kind==='new').length,1);assert.equal(b.notifications.length,0);assert.equal(a.campaigns[0].winners,null);assert.equal(a.campaigns[0].free,true);assert.equal(a.campaigns[0].imageUrl,'https://campaign.kirin.co.jp/campaign/images/example');await ingest(db,[{...campaign('first'),imageUrl:null}]);assert.equal((await bootstrap({DB:db},'alice')).campaigns.find(c=>c.title===campaign('first').title&&c.id===1).imageUrl,null);assert.equal((await bootstrap({DB:db},'alice')).notifications.length,2);sql.prepare('INSERT INTO bookmarks VALUES(?,?,?)').run('alice',a.campaigns[0].id,new Date().toISOString());assert.equal((await bootstrap({DB:db},'alice')).saved.length,1);assert.equal((await bootstrap({DB:db},'bob')).saved.length,0);sql.prepare('UPDATE wishes SET notify=0 WHERE user_id=?').run('alice');await ingest(db,[campaign('third')]);assert.equal((await bootstrap({DB:db},'alice')).notifications.length,2)});
test('Web Pushは暗号化し、複数端末の再試行時に成功済み端末へ再送しない',async()=>{const {sql,db}=database(),keys=vapid(),a=subscription('ok'),b=subscription('retry');await addWish(db,'alice','コーヒー',true);await ingest(db,[campaign('push-new')]);for(const s of [a,b])sql.prepare('INSERT INTO push_subscriptions(endpoint,user_id,subscription,created_at) VALUES(?,?,?,?)').run(s.endpoint,'alice',JSON.stringify(s),new Date().toISOString());const calls=[];let retry=true;const previousFetch=globalThis.fetch;globalThis.fetch=async(url,request)=>{calls.push({url,request});return new Response(null,{status:String(url).endsWith('retry')&&retry?503:201});};try{await deliverPending({...keys,DB:db});assert.equal(calls.length,2);assert.equal(calls[0].request.headers['content-encoding'],'aes128gcm');assert.match(calls[0].request.headers.authorization,/^vapid /);assert.equal(new Uint8Array(calls[0].request.body).length,4096);retry=false;await deliverPending({...keys,DB:db});assert.equal(calls.length,3);assert.equal(calls[2].url,b.endpoint);await deliverPending({...keys,DB:db});assert.equal(calls.length,3);assert.equal(sql.prepare('SELECT push_status FROM notifications').get().push_status,'sent');await ingest(db,[campaign('expired-push')]);sql.prepare('UPDATE campaigns SET deadline=? WHERE source_key=?').run(new Date(Date.now()-1000).toISOString(),'expired-push');await deliverPending({...keys,DB:db});assert.equal(calls.length,3);assert.equal(validSubscription({...a,endpoint:'https://127.0.0.1/private'}),false);await assert.rejects(sendPush({...keys,DB:db},{...a,endpoint:'https://evil.test/'},{title:'x'}));}finally{globalThis.fetch=previousFetch;}});

test('確認済みの同一企画だけを統合し、地域の応募先URLは保持する',()=>{
 const a=campaign('retailer'),b={...campaign('regional'),evidence:{canonicalCampaignUrl:a.officialUrl}};
 assert.equal(campaignIdentity(a),campaignIdentity(b));assert.notEqual(a.officialUrl,b.officialUrl);
 assert.notEqual(campaignIdentity(a),campaignIdentity({...b,evidence:{}}));
});
test('公開期間が残っていても実際の応募期間が終了したdポイント企画は除外する',()=>{
 const r=(id,start,end)=>({campaign:{campaign_id:id,contents_info:{title:'抽選でポイントが当たる',contents_url:'https://dpoint.docomo.ne.jp/cp/'+id},abailable_period:{start_date:start,end_date:end,published_date:'2026-01-01 00:00:00',close_date:'2027-12-31 23:59:00'}}});
 const rows=parseDocomoIndex({id:'dpoint',name:'dポイント',url:'https://dpoint.docomo.ne.jp/campaign/index.html'},'callback('+JSON.stringify({campaign_list:[r('old','2026-08-01 00:00:00','2026-09-01 23:59:00'),r('current','2026-11-01 00:00:00','2026-11-30 23:59:00'),r('future','2026-12-01 00:00:00','2026-12-31 23:59:00')]})+')',new Date('2026-11-04T12:00:00Z'));
 assert.equal(rows.length,1);assert.equal(rows[0].sourceKey,'dpoint:current');assert.equal(rows[0].deadline,'2026-11-30T14:59:00.000Z');
});
test('公式の締切表記では日付の数値形式・括弧内の時刻・午後を保持する',()=>{
 const now=new Date('2026-11-04T00:00:00Z');
 assert.equal(dateFromJapanese('2026年11月30日（23:59まで）',now),'2026-11-30T14:59:00.000Z');
 assert.equal(dateFromJapanese('2026/11/30 午後5時',now),'2026-11-30T08:00:00.000Z');
 assert.equal(dateFromJapanese('2026.11.30 10:59',now),'2026-11-30T01:59:00.000Z');
 assert.equal(dateFromJapanese('2026年11月31日',now),null);
});

test('一つの詳細ページを別企画の根拠にせず、終了後の個人情報文言を受付終了と誤認しない',()=>{
 const source={id:'retail-getcp',name:'公式',url:'https://get-cp.com/',selector:'body',selfEvidence:true},first=SNAPSHOT_RECORDS.find(c=>c.sourceId===source.id);
 const html='<body>キャンペーンに応募すると抽選でプレゼント。個人情報はキャンペーン終了後に削除します。</body>';
 const rows=revalidateSnapshot(source,html,new Date('2026-11-04T12:00:00Z'),first.officialUrl);
 assert.equal(rows.length,1);assert.equal(rows[0].sourceKey,first.sourceKey);
 assert.equal(revalidateSnapshot(source,'<body>応募受付終了しました</body>',new Date('2026-11-04T12:00:00Z'),first.officialUrl).length,0);
 assert.equal(revalidateSnapshot(source,html,new Date('2026-11-04T12:00:00Z'),'https://get-cp.com/unrelated/').length,0);
});

test('略称スタバでも公式名のキャンペーンを検索・通知対象として扱う',()=>{assert.equal(matchesWish({...campaign('starbucks'),title:'スターバックスのeGift',tags:[]},'スタバ'),true);});

test('確認済みの別公式URLでも同じ懸賞を二件として登録しない',async()=>{
 const {sql,db}=database(),first={...campaign('nissin-detail'),officialUrl:'https://www.nissin.com/jp/product/campaigns/373/'},second={...campaign('pilkul-form'),sourceId:'organizer',officialUrl:'https://www.pilkul.jp/cp26-51all/'};
 await ingest(db,[first]);await ingest(db,[second]);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n,1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM campaign_sources').get().n,2);
});

test('審査済み収集設定は実行可能CSSと保存可能な値だけを含む',()=>{
 const $=load('<div></div>');for(const source of SNAPSHOT_SOURCES){assert.doesNotThrow(()=>$(source.selector),source.id);assert.ok((source.pages?.length||1)<=24,source.id);}
 const ids=new Set(SNAPSHOT_SOURCES.map(s=>s.id));for(const c of SNAPSHOT_RECORDS){assert.ok(ids.has(c.sourceId),c.sourceKey);for(const key of ['sourceId','sourceKey','title','brand','officialUrl','sourceUrl','summary','category','methods','tags','deadline','startsAt','winners','free','noRegistration','daily','instant','ageRestricted','evidence'])assert.notEqual(c[key],undefined,c.sourceKey+':'+key);assert.ok(Array.isArray(c.tags)&&Array.isArray(c.methods));assert.equal(new URL(c.officialUrl).protocol,'https:');}
});
test('確認訂正された不明の応募締切を、以前の開催期間のまま残さない',async()=>{
 const {sql,db}=database(),c={...campaign('corrected-period'),evidence:{metadataPriority:3,entryConditionsVerified:true}};await ingest(db,[c]);await ingest(db,[{...c,deadline:null,evidence:{metadataPriority:3,deadlinePrecision:'unconfirmed'}}]);assert.equal(sql.prepare('SELECT deadline FROM campaigns').get().deadline,null);
});


test('限定条件を具体化し、購入不要だけで追加条件なしにしない',()=>{
 for(const [summary,id] of [
 ['森永乳業の対象商品1点を含む税込1,620円以上の購入レシートが必要','purchase'],
 ['JAF会員限定のクロスワード。会員情報を入力','paid_membership'],
 ['当日のテレビのデータ放送に表示される応募番号が必要','viewing_code'],
 ['口座が必要。DLsiteで決済を合計5,000円以上利用','financial'],
 ['大阪府在住の方が対象','audience'],['来店して引換が必要','visit'],['使用後レビューの投稿が必要','creative']]){
  const e=entryConditions({...campaign(id),summary});assert.equal(e.status,'conditional',summary);assert.ok(e.requirements.some(r=>r.id===id),summary);assert.ok(e.requirements.find(r=>r.id===id).detail.includes(summary.split("。")[0]),summary);
 }
 assert.equal(entryConditions({...campaign('unconfirmed'),evidence:{},free:true}).status,'unknown');
 assert.equal(entryConditions({...campaign('unknown'),evidence:{},free:null}).status,'unknown');
 const simple=entryConditions({...campaign('simple'),summary:'購入不要。無料会員登録とXフォロー・リポスト。クイズに回答',methods:['X']});assert.equal(simple.status,'open');assert.ok(simple.steps.some(s=>s.includes('無料')));
 assert.equal(entryConditions({...campaign('monitor'),title:'ゲーミングモニターが当たる',tags:['モニター']}).status,'open');
 assert.equal(entryConditions({...campaign('negation'),summary:'購入不要。来店不要。会員登録不要。'}).status,'open');
});

test('追加条件なしの新規だけを収集し、既存の条件付き情報は更新・保存する',async()=>{
 const {sql,db}=database();const old={...campaign('old-conditional'),summary:'購入レシートが必要'};await ingest(db,[old]);await addWish(db,'alice','コーヒー',true);
 const result=await ingest(db,[{...old,summary:'購入レシートが必要。対象金額1,620円。'},campaign('easy'),{...campaign('hard'),summary:'JAF会員限定'},{...campaign('uncertain'),evidence:{}}],undefined,'open_new');
 assert.equal(result.added,1);assert.equal(result.skipped,2);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n,2);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
 assert.match(sql.prepare('SELECT summary FROM campaigns WHERE source_key=?').get(old.sourceKey).summary,/1,620/);
 const view=await bootstrap({DB:db},'alice');assert.deepEqual(view.conditionCounts,{open:1,conditional:1,unknown:0});assert.equal(view.campaigns.find(c=>c.id===1).entryConditions.requirements[0].id,'purchase');
});

test('通知作成後に条件が判明した企画へブラウザ通知を送らない',async()=>{
 const {sql,db}=database();await addWish(db,'alice','コーヒー',true);await ingest(db,[campaign('late-condition')]);sql.prepare("UPDATE campaigns SET summary='JAF会員限定' WHERE id=1").run();
 let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;return new Response(null,{status:201});};try{await deliverPending({...vapid(),DB:db});assert.equal(calls,0);assert.equal(sql.prepare('SELECT push_status FROM notifications').get().push_status,'filtered_conditions');}finally{globalThis.fetch=previous;}
});
