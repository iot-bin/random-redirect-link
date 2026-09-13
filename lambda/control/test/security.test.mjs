import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.mjs';
import { validateConfig } from '../src/domain.mjs';
const sub='11111111-1111-4111-8111-111111111111';
const target={id:'aws-01',name:'One',apiId:'abc123',stage:'$default',enabled:true,redirectBaseUrl:'https://example.com'};
const configuration={version:1,site:{title:'Console',description:'Links'},targets:[target],defaultTargetId:'aws-01'};
function fixture(role='member',grant='viewer') {
  const records=new Map([['CONFIG',structuredClone(configuration)],['MEMBER#'+sub,{sub,active:true,role,grants:{'aws-01':grant},version:1}],['OWNER',{sub}]]);
  const calls=[],audit=[];
  const db={get:async k=>records.get(k),put:async(k,v,expected)=>{
    if(expected!==undefined && (records.get(k)?.version??0)!==expected) throw Object.assign(new Error('conflict'),{name:'ConditionalCheckFailedException'});
    records.set(k,v);
  },audit:async a=>audit.push(a),listMembers:async()=>[],listAudit:async()=>audit};
  const handler=createHandler({db,upstream:async(...args)=>{calls.push(args);return {statusCode:200,payload:{ok:true}};},users:{exists:async()=>true},apiIds:['abc123'],clientId:'client',issuer:'issuer',now:()=>1000000,logger:{error(){}}});
  const event=(method='GET',path='/me',body,claims={})=>({rawPath:path,body:body===undefined?undefined:JSON.stringify(body),requestContext:{http:{method},authorizer:{jwt:{claims:{sub,token_use:'access',client_id:'client',iss:'issuer',exp:2000,origin_jti:'session-one',...claims}}}}});
  return {handler,event,records,calls,audit,db};
}
test('rejects absent authorizer, ID tokens, wrong clients and missing expiry',async()=>{
  const f=fixture();
  assert.equal((await f.handler({rawPath:'/me',requestContext:{http:{method:'GET'}}})).statusCode,401);
  for(const claims of [{token_use:'id'},{client_id:'other'},{exp:undefined},{exp:999},{iss:'evil'}]) assert.equal((await f.handler(f.event('GET','/me',undefined,claims))).statusCode,401);
  assert.equal(f.calls.length,0);
});
test('public configuration contains no API IDs or membership data',async()=>{
  const f=fixture();const r=await f.handler({rawPath:'/public/site',requestContext:{http:{method:'GET'}}});
  assert.deepEqual(JSON.parse(r.body),configuration.site);
});
test('viewer can read own environment but cannot mutate, batch or cross environments',async()=>{
  const f=fixture();
  assert.equal((await f.handler(f.event('GET','/targets/aws-01/links'))).statusCode,200);
  for(const [method,path] of [['POST','/targets/aws-01/links'],['POST','/targets/aws-01/links/batch'],['PATCH','/targets/aws-01/links/x'],['DELETE','/targets/aws-01/links/x'],['GET','/targets/aws-02/links']]) assert.equal((await f.handler(f.event(method,path,{}))).statusCode,403);
  assert.equal(f.calls.length,1);
});
test('permissions are checked again after member revocation',async()=>{
  const f=fixture();await f.handler(f.event());f.records.get('MEMBER#'+sub).active=false;
  assert.equal((await f.handler(f.event())).statusCode,403);
});
test('disabled Cognito users are rejected even with an unexpired token',async()=>{
  const f=fixture();const handler=createHandler({db:f.db,users:{exists:async()=>false},clientId:'client',issuer:'issuer',now:()=>1000000});
  assert.equal((await handler(f.event())).statusCode,403);
});
test('logout revokes the token family including subsequent refresh tokens',async()=>{
  const f=fixture();assert.equal((await f.handler(f.event('POST','/session/revoke'))).statusCode,200);
  assert.equal((await f.handler(f.event())).statusCode,401);
  assert.equal((await f.handler(f.event('GET','/me',undefined,{origin_jti:'new-login'}))).statusCode,200);
});
test('me filters environments and never exposes backend coordinates',async()=>{
  const f=fixture();f.records.get('CONFIG').targets.push({...target,id:'aws-02'});
  const result=JSON.parse((await f.handler(f.event())).body);
  assert.equal(result.targets.length,1);assert.equal(result.targets[0].canWrite,false);
  assert.equal(result.targets[0].apiId,undefined);
});
test('editor writes have a durable attempt and result; bodies with URLs are not logged',async()=>{
  const f=fixture('member','editor');
  assert.equal((await f.handler(f.event('POST','/targets/aws-01/links',{path:'a',targetUrl:'https://private.example'}))).statusCode,200);
  assert.deepEqual(f.audit.map(a=>a.phase),['attempt','result']);
  assert.equal(JSON.stringify(f.audit).includes('private.example'),false);
});
test('audit failure before dispatch prevents the mutation',async()=>{
  const f=fixture('member','editor');f.db.audit=async()=>{throw new Error('unavailable');};
  assert.equal((await f.handler(f.event('POST','/targets/aws-01/links',{}))).statusCode,503);assert.equal(f.calls.length,0);
});
test('members cannot change configuration, permissions or inspect audits',async()=>{
  const f=fixture();for(const path of ['/config','/members','/audit']) assert.equal((await f.handler(f.event('GET',path))).statusCode,403);
});
test('owner and current admin cannot be disabled by the member editor',async()=>{
  const f=fixture('admin');assert.equal((await f.handler(f.event('PUT','/members',{sub,active:false,role:'member',grants:{},version:1}))).statusCode,409);
});
test('configuration rejects arbitrary signing hosts, duplicate targets and invalid defaults',()=>{
  assert.equal(validateConfig(configuration,['abc123']).version,2);
  for(const input of [{...configuration,targets:[{...target,apiId:'evil.com'}]},{...configuration,targets:[target,target]},{...configuration,targets:[{...target,stage:'../bad'}]},{...configuration,defaultTargetId:'missing'}]) assert.throws(()=>validateConfig(input,['abc123']));
});
test('rejects path traversal before signing upstream requests',async()=>{
  const f=fixture('admin');for(const path of ['/targets/aws-01/links/../config','/targets/aws-01/links/%2e%2e/config','/targets/aws-01/links/%2fadmin','/targets/aws-01/links/%ZZ']) assert.equal((await f.handler(f.event('GET',path))).statusCode,400);
  assert.equal(f.calls.length,0);
});
test('configuration rejects missing or incorrectly typed identifiers',()=>{
  for (const key of ['id','apiId','stage']) {
    for (const value of [undefined,null,1,{}]) {
      assert.throws(()=>validateConfig({...configuration,targets:[{...target,[key]:value}]},['abc123']));
    }
  }
  assert.throws(()=>validateConfig({...configuration,defaultTargetId:42},['abc123']));
});
