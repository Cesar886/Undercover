// Run only against a disposable PostgreSQL database named audit_reports_*.
// AUDIT_DATABASE_URL=... node scripts/test-community-postgres.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { randomUUID, createHash } = require('crypto');
const root = path.resolve(__dirname, '..');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, ...args);
};
const { Pool } = require('pg');
const { NextRequest } = require('next/server');
const connectionString = process.env.AUDIT_DATABASE_URL || (process.env.AUDIT_DB_CONFIG && JSON.parse(fs.readFileSync(process.env.AUDIT_DB_CONFIG)).connectionString);
if (!connectionString || !/^\/audit_reports_[a-f0-9]+$/.test(new URL(connectionString).pathname)) throw new Error('Use an isolated audit_reports_<hex> database.');
process.env.ANON_SALT = 'isolated-community-audit-salt';
process.env.NODE_ENV = 'test';
const pool = new Pool({ connectionString, max: 15, connectionTimeoutMillis: 10000, options: '-c statement_timeout=30000' });
global._pgPool = pool;
const load = name => require(path.join(root, name));
const { reportContent, communitySuspension, ensureCommunitySchema } = load('lib/communityModeration.ts');
const { getAnonId } = load('lib/anon.ts');
const ownerToken = randomUUID();
let serial = 0;
const events = [];
const unsubscribe = load('lib/events.ts').subscribeFeed(event => events.push(event));
const results = [];
const browserId = token => { const h = createHash('sha256').update(token).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
function req(token, ip, body = { reason: 'spam' }, method = 'POST', owner = browserId(token)) {
  return new NextRequest('http://localhost/api/posts', { method, headers: {
    cookie: `anon_token=${token}`, 'x-real-ip': ip || '192.0.2.1', 'x-owner-token': owner,
  }, ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
}
const anon = token => getAnonId(req(token)).anonId;
const identity = () => { const n = ++serial; return { token: `reader-${n}`, ip: '192.0.2.1' }; };
async function post(token = 'author', hidden = false) {
  const id = randomUUID();
  await pool.query(`INSERT INTO posts(id,anon_id,content,category,owner_token,owner_hidden) VALUES($1,$2,'audit','general',$3,$4)`, [id,anon(token),browserId(token),hidden]);
  return id;
}
async function row(id) { return (await pool.query('SELECT * FROM posts WHERE id=$1',[id])).rows[0]; }
async function send(id, who = identity(), commentId) { return reportContent(req(who.token,who.ip), id, commentId); }
async function quorum(id) {
  const responses = await Promise.all(Array.from({length:5},()=>send(id)));
  assert.deepEqual(responses.map(r=>r.status),[200,200,200,200,200]);
  assert.equal((await row(id)).report_count,5);
  assert.equal((await row(id)).is_hidden,true);
}
async function test(name, fn) {
  const start = Date.now();
  await fn(); results.push({ name, status:'passed', durationMs:Date.now()-start }); console.log('PASS',name);
}
(async()=>{
 try {
  const db = await pool.query('SELECT version() AS version');
  console.log(db.rows[0].version);
  assert.equal((await pool.query("SELECT to_regclass('public.posts') AS existing")).rows[0].existing,null,'Database must be empty');
  await pool.query(fs.readFileSync(path.join(root,'sql/schema.sql'),'utf8'));
  for(const file of fs.readdirSync(path.join(root,'sql/migrations')).sort()) await pool.query(fs.readFileSync(path.join(root,'sql/migrations',file),'utf8'));
  await pool.query(`CREATE TABLE notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID, comment_id UUID, recipient_username TEXT, type TEXT, actor_username TEXT)`);
  await ensureCommunitySchema();
  const postRoutes = load('app/api/posts/[id]/route.ts');
  const createPost = load('app/api/posts/route.ts').POST;
  const commentRoutes = load('app/api/posts/[id]/comments/route.ts');
  const editComment = load('app/api/posts/[id]/comments/[commentId]/route.ts').PATCH;
  const visibility = load('app/api/posts/[id]/visibility/route.ts').PATCH;
  await test('legacy network constraint migration is idempotent and preserves report rows', async()=>{
    const target=randomUUID();
    await pool.query(`ALTER TABLE community_reports ADD COLUMN network_key TEXT NOT NULL DEFAULT 'legacy';
      ALTER TABLE community_reports ADD UNIQUE(target_type,target_id,network_key);
      CREATE INDEX community_reports_network_idx ON community_reports(network_key,created_at)`);
    await pool.query("INSERT INTO community_reports(target_type,target_id,reporter_id,reason) VALUES('post',$1,'legacy-reader','spam')",[target]);
    const migration=fs.readFileSync(path.join(root,'sql/migrations/011_reports_without_ip.sql'),'utf8');
    await pool.query(migration);await pool.query(migration);
    assert.equal((await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='community_reports' AND column_name='network_key'")).rows[0].is_nullable,'YES');
    assert.equal((await pool.query('SELECT network_key FROM community_reports WHERE target_id=$1',[target])).rows[0].network_key,'legacy');
    await pool.query("INSERT INTO community_reports(target_type,target_id,reporter_id,reason) VALUES('post',$1,'new-reader-1','spam'),('post',$1,'new-reader-2','spam')",[target]);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM community_reports WHERE target_id=$1 AND network_key IS NULL',[target])).rows[0].n,2);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM community_reports WHERE target_id=$1',[target])).rows[0].n,3);
  });
  await test('report accepts no IP header and emits no anonymous cookie',async()=>{
    const request=req('no-network');request.headers.delete('x-real-ip');request.headers.delete('cookie');
    const response=await reportContent(request,await post('no-network-author'));
    assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
  });
  await test('same ID concurrent quota is 10; another ID on same IP can report a comment and post',async()=>{
    const who=identity();const ids=await Promise.all(Array.from({length:15},()=>post('concurrent-quota-author')));
    const responses=await Promise.all(ids.map(id=>send(id,who)));
    assert.equal(responses.filter(r=>r.status===200).length,10);assert.equal(responses.filter(r=>r.status===429).length,5);
    const parent=await post('comment-quota-author');const cid=randomUUID();
    await pool.query("INSERT INTO comments(id,post_id,anon_id,content) VALUES($1,$2,$3,'audit')",[cid,parent,anon('comment-quota-author')]);
    assert.equal((await send(parent,who,cid)).status,429);
    const other=identity();assert.equal((await send(parent,other,cid)).status,200);assert.equal((await send(parent,other)).status,200);
  });
  await test('legacy IP ban cannot block posting or commenting from campus',async()=>{
    await pool.query("INSERT INTO ip_bans(ip,reason,expires_at,offense_count) VALUES('192.0.2.1','legacy',NOW()+INTERVAL '1 day',1)");
    for(const token of ['campus-one','campus-two']) {
      assert.equal((await createPost(req(token,undefined,{content:'campus post',category:'general'}))).status,201);
      assert.equal((await commentRoutes.POST(req(token,undefined,{content:'campus comment'}),{params:{id:await post('campus-parent')}})).status,201);
    }
  });
  await test('same localStorage ID: one report across tabs/IPs; new ID on same IP accepted',async()=>{
    const id=await post('duplicate-author');const who=identity();
    const responses=await Promise.all(Array.from({length:20},()=>reportContent(req(who.token,who.ip,{reason:'spam'},'POST'),id)));
    assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===409).length,19);
    assert.equal((await send(id,{token:who.token,ip:'203.0.113.9'})).status,409);
    assert.equal((await send(id,{token:identity().token,ip:who.ip})).status,200);
    assert.equal((await row(id)).report_count,2);
  });
  await test('exact threshold: reports 1–4 visible, fifth hidden, read=404 and owner unhide=403',async()=>{
    const id=await post('threshold-author',true);
    for(let n=1;n<=4;n++){assert.equal((await send(id)).status,200);assert.equal((await row(id)).is_hidden,false);assert.equal((await row(id)).report_count,n);}
    const fifth=await send(id);assert.equal((await fifth.json()).is_hidden,true);
    assert.equal((await row(id)).owner_hidden,true);
    assert.equal((await postRoutes.GET(req('threshold-author',undefined,undefined,'GET'),{params:{id}})).status,404);
    assert.equal((await visibility(req('threshold-author',undefined,{hidden:false},'PATCH'),{params:{id}})).status,403);
    assert.equal((await row(id)).is_hidden,true);
    assert.equal(events.filter(e=>e.type==='post:hidden'&&e.postId===id).length,1);
  });
  await test('20 rounds of 5 simultaneous distinct reports: 100 accepted, none lost, one hide/strike each',async()=>{
    for(let round=0;round<20;round++){
      const token=`race-author-${round}`;const id=await post(token);await quorum(id);
      assert.equal(events.filter(e=>e.type==='post:hidden'&&e.postId===id).length,1);
      assert.equal((await pool.query('SELECT hidden_count FROM community_sanctions WHERE anon_id=$1',[anon(token)])).rows[0].hidden_count,1);
    }
  });
  await test('quota: 10/hour per identity across IPs and targets; 11th rejected; other identity on same IP unaffected; expires',async()=>{
    const who=identity();const ids=await Promise.all(Array.from({length:11},()=>post('quota-author')));
    for(let n=0;n<10;n++)assert.equal((await send(ids[n],{token:who.token,ip:`203.0.113.${n+1}`})).status,200);
    assert.equal((await send(ids[10],{token:who.token,ip:identity().ip})).status,429);
    assert.equal((await send(ids[10],{token:identity().token,ip:who.ip})).status,200);
    await pool.query("UPDATE community_reports SET created_at=NOW()-INTERVAL '61 minutes' WHERE reporter_id=$1",[anon(who.token)]);
    assert.equal((await send(ids[10],{token:who.token,ip:identity().ip})).status,200);
  });
  await test('independent identities on a shared network do not accumulate a shared budget',async()=>{
    const who=identity();const network=identity().ip;
    for(let i=0;i<6;i++)assert.equal((await send(await post('mixed-quota-author'),{token:who.token,ip:identity().ip})).status,200);
    for(let i=0;i<4;i++)assert.equal((await send(await post('mixed-quota-author'),{token:identity().token,ip:network})).status,200);
    assert.equal((await send(await post('mixed-quota-author'),{token:who.token,ip:network})).status,200);
  });
  await test('quota: 15 concurrent different identities on same IP => all 15 accepted',async()=>{
    const ip=identity().ip;const ids=await Promise.all(Array.from({length:15},()=>post('network-quota-author')));
    const responses=await Promise.all(ids.map(id=>send(id,{token:identity().token,ip})));
    assert.equal(responses.filter(r=>r.status===200).length,15);assert.equal(responses.filter(r=>r.status===429).length,0);
  });
  await test('sanctions: 3=1h, 5=24h, 10=7d; 11th renews seven days without permanent escalation',async()=>{
    for(let n=1;n<=11;n++){
      await quorum(await post('sanction-author'));
      const state=(await pool.query('SELECT *,EXTRACT(EPOCH FROM suspended_until-NOW())/3600 AS hours FROM community_sanctions WHERE anon_id=$1',[anon('sanction-author')])).rows[0];
      assert.equal(state.hidden_count,n);
      if(n<3)assert.equal(state.suspended_until,null);
      else {const expected=n>=10?168:n>=5?24:1;assert.ok(Number(state.hours)<=expected&&Number(state.hours)>expected-.02);}
    }
  });
  await test('active sanction blocks actual create post/comment, edit post/comment and report routes; expiration reopens all five',async()=>{
    const token='sanction-author';const own=await post(token);const victim=await post('victim');const cid=randomUUID();
    await pool.query("INSERT INTO comments(id,post_id,anon_id,content) VALUES($1,$2,$3,'audit')",[cid,own,anon(token)]);
    async function actions(){return [
      await createPost(req(token,undefined,{content:'after suspension',category:'general'})),
      await commentRoutes.POST(req(token,undefined,{content:'after suspension'}),{params:{id:own}}),
      await postRoutes.PATCH(req(token,undefined,{content:'edited'},'PATCH'),{params:{id:own}}),
      await editComment(req(token,undefined,{content:'edited'},'PATCH'),{params:{id:own,commentId:cid}}),
      await reportContent(req(token,'203.0.113.88'),victim),
    ];}
    assert.deepEqual((await actions()).map(r=>r.status),[403,403,403,403,403]);
    // A fresh localStorage identifier evades the sanction even with the old cookie and same IP.
    assert.equal((await createPost(req(token,undefined,{content:'try again',category:'general'},'POST',randomUUID()))).status,201);
    assert.equal(await communitySuspension(anon('other-device')),null);
    assert.equal((await createPost(req('other-device',undefined,{content:'new identity',category:'general'}))).status,201);
    await pool.query("UPDATE community_sanctions SET suspended_until=NOW()-INTERVAL '1 second' WHERE anon_id=$1",[anon(token)]);
    assert.deepEqual((await actions()).map(r=>r.status),[201,201,200,200,200]);
    assert.equal((await pool.query('SELECT hidden_count FROM community_sanctions WHERE anon_id=$1',[anon(token)])).rows[0].hidden_count,11);
  });
  await test('transaction rollback: failed sanction cannot commit fifth report or hide; retry gives one strike',async()=>{
    const id=await post('rollback-author');for(let i=0;i<4;i++)await send(id);
    await pool.query(`CREATE FUNCTION fail_audit_strike() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit rollback'; END $$;
      CREATE TRIGGER audit_fail BEFORE INSERT ON community_sanctions FOR EACH ROW EXECUTE FUNCTION fail_audit_strike()`);
    const who=identity();assert.equal((await send(id,who)).status,500);
    assert.equal((await row(id)).report_count,4);assert.equal((await row(id)).is_hidden,false);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM community_reports WHERE target_id=$1',[id])).rows[0].n,4);
    await pool.query('DROP TRIGGER audit_fail ON community_sanctions; DROP FUNCTION fail_audit_strike()');
    assert.equal((await send(id,who)).status,200);assert.equal((await row(id)).is_hidden,true);
  });
  await test('new post/comment images stay private pending; only manual review publishes; community-hidden posts remain hidden',async()=>{
    const sharp=require('sharp');const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#ff0000'}}).png().toBuffer();
    const image='data:image/png;base64,'+bytes.toString('base64');const parent=await post('image-author');
    for(const kind of ['post','comment']){
      const r=kind==='post'?await createPost(req('image-author',undefined,{content:'image',category:'general',image})):await commentRoutes.POST(req('image-author',undefined,{content:'image',image}),{params:{id:parent}});
      assert.equal(r.status,201);const body=await r.json();assert.equal(body.image_status,'pending');assert.equal(body[kind].image_webp,null);
      const col=kind==='post'?'post_id':'comment_id';const review=(await pool.query(`SELECT * FROM image_reviews WHERE ${col}=$1`,[body[kind].id])).rows[0];
      assert.equal(review.status,'pending');assert.ok(review.image_data);assert.equal(review.public_visible,false);
      const {reviewImage}=load('lib/imageReviews.ts');assert.equal(await reviewImage(review.id,'approved'),true);
      assert.ok((await pool.query(`SELECT image_webp FROM ${kind==='post'?'posts':'comments'} WHERE id=$1`,[body[kind].id])).rows[0].image_webp);
      if(kind==='post') {await quorum(body.post.id);await reviewImage(review.id,'approved');assert.equal((await row(body.post.id)).is_hidden,true);}
    }
  });
  await test('weekly Monday 05:00 Monterrey deletes community-hidden and owner-hidden posts equally; preserves sanctions and seed exception',async()=>{
    const owner=await post('weekly-owner',true);const hidden=await post('weekly-community');await quorum(hidden);
    const seed=await post('weekly-seed');await pool.query('UPDATE posts SET is_seed=true WHERE id=$1',[seed]);
    const {runQuema,isQuemaTime}=load('lib/quema.ts');const monday=new Date('2026-09-28T11:00:00Z');
    assert.equal(isQuemaTime(monday),true);assert.equal(isQuemaTime(new Date('2026-09-28T10:59:00Z')),false);assert.equal(isQuemaTime(new Date('2026-09-28T11:01:00Z')),false);
    const before=(await pool.query('SELECT * FROM community_sanctions ORDER BY anon_id')).rows;
    const dry=await runQuema({dryRun:true,now:monday});assert.ok(dry.counts.posts_hidden>=2);assert.ok(await row(owner));assert.ok(await row(hidden));
    const actual=await runQuema({dryRun:false,now:monday});assert.equal(actual.skipped,false);
    assert.equal(await row(owner),undefined);assert.equal(await row(hidden),undefined);assert.ok(await row(seed));
    assert.deepEqual((await pool.query('SELECT * FROM community_sanctions ORDER BY anon_id')).rows,before);
    assert.equal((await runQuema({dryRun:false,now:monday})).skipped,true);
  });
  console.log(`PASS ${results.length} PostgreSQL integration groups`);
 } catch(error){results.push({name:'audit failure',status:'failed',message:error.message});console.error(error.stack);process.exitCode=1;}
 finally {unsubscribe();await pool.end();fs.writeFileSync(process.env.AUDIT_RESULTS_PATH||'/tmp/community-postgres-results.json',JSON.stringify({date:new Date().toISOString(),results},null,2));}
})();
