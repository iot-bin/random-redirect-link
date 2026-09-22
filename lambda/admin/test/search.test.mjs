import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, parseSearch, recordState } from '../src/search.mjs';
process.env.TABLE_NAME = 'test-table';
const { ddb } = await import('../src/dynamodb.mjs');
const { listLinks } = await import('../src/handlers/links.mjs');
const { listLinkRecords } = await import('../src/repository.mjs');

test('contains matches paths and both target formats without case sensitivity', () => {
  assert.ok(matchesSearch({path:'aq/Zheng121'}, {q:'zheng'}, 0));
  assert.ok(matchesSearch({path:'x',targetUrl:'https://Example.com/File.apk'}, {q:'EXAMPLE'}, 0));
  assert.ok(matchesSearch({path:'x',targetBaseUrl:'https://example.com',targetPath:'/App.apk'}, {q:'.COM/app'}, 0));
  assert.equal(matchesSearch({path:'aq/Zheng121'}, {q:'zheng',match:'prefix'}, 0), false);
  assert.equal(matchesSearch({path:'aq/Zheng121'}, {q:'aq/zheng121',match:'exact'}, 0), false);
  assert.equal(matchesSearch({path:'abc'}, {q:'a.*'}, 0), false);
});

test('status precedence matches lifecycle badges, including retention boundary', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(recordState({purgeAt:now/1000,deletedAt:'2029-01-01'}, now), 'purged');
  assert.equal(recordState({deletedAt:'2029-01-01'}, now), 'deleted');
  assert.equal(recordState({expiresAt:'2030-01-01T00:00:00Z',enabled:false}, now), 'expired');
  assert.equal(recordState({enabled:false,startsAt:'2031-01-01'}, now), 'disabled');
  assert.equal(recordState({startsAt:'2031-01-01'}, now), 'scheduled');
  assert.equal(recordState({}, now), 'active');
  assert.equal(matchesSearch({path:'x',enabled:false}, {state:'active'}, now), false);
});

test('invalid queries are rejected and empty queries retain filters', () => {
  for (const q of [{q:'x'.repeat(513)}, {q:'\nabc'}, {match:'regex'}, {sort:'updatedAt'}, {state:'bad'}]) {
    // Outer whitespace is trimmed, so place the control character inside the term.
    if (q.q === '\nabc') q.q = 'a\nb';
    assert.throws(() => parseSearch(q), {code:'INVALID_SEARCH'});
  }
  assert.equal(parseSearch({q:'   ',state:'disabled'}).state, 'disabled');
});

test('contains traverses pages, respects descending order, and never drops overflow matches', async t => {
  const rows = [
    {path:'z',listPk:'LINK',targetUrl:'https://example.com/no'},
    {path:'y',listPk:'LINK',targetUrl:'https://example.com/HIT'},
    {path:'x',listPk:'LINK',targetUrl:'https://example.com/hit'},
    {path:'w',listPk:'LINK',targetUrl:'https://example.com/hit'},
  ];
  t.mock.method(ddb,'send',async command => {
    const input = command.input;
    assert.equal(input.ScanIndexForward,false);
    const start = input.ExclusiveStartKey ? rows.findIndex(r=>r.path===input.ExclusiveStartKey.path)+1 : 0;
    const page = rows.slice(start,start+input.Limit);
    const last = page.at(-1);
    return {Items:page,LastEvaluatedKey:start+page.length<rows.length?{path:last.path,listPk:'LINK'}:undefined};
  });
  const search={q:'hit',sort:'path-desc'};
  const first=await listLinkRecords({limit:2,prefix:'',search});
  const second=await listLinkRecords({limit:2,prefix:'',search,exclusiveStartKey:first.LastEvaluatedKey});
  assert.deepEqual(first.Items.map(r=>r.path),['y','x']);
  assert.deepEqual(second.Items.map(r=>r.path),['w']);
});

test('bounded searches preserve a continuation cursor even without matches', async t => {
  let calls=0;
  t.mock.method(ddb,'send',async()=>({Items:[{path:'no'}],LastEvaluatedKey:{path:String(++calls),listPk:'LINK'}}));
  const result=await listLinkRecords({limit:25,prefix:'',search:{q:'missing'}});
  assert.equal(calls,20);
  assert.deepEqual(result.Items,[]);
  assert.equal(result.LastEvaluatedKey.path,'20');
});

test('cursor scope binds search, state, ordering and view', async t => {
  t.mock.method(ddb,'send',async()=>({Items:[{path:'hit'}],LastEvaluatedKey:{path:'hit',listPk:'LINK'}}));
  const query={q:'hit',limit:'1',sort:'path-asc',state:'all'};
  const first=JSON.parse((await listLinks({queryStringParameters:query})).body);
  assert.ok(first.nextCursor);
  for (const changed of [{q:'other'},{state:'disabled'},{sort:'path-desc'},{view:'trash'},{match:'prefix'}]) {
    await assert.rejects(listLinks({queryStringParameters:{...query,...changed,cursor:first.nextCursor}}),{code:'INVALID_CURSOR'});
  }
});

test('exact search uses a consistent read and respects view and status', async t => {
  t.mock.method(ddb,'send',async command=>{
    assert.equal(command.constructor.name,'GetCommand');
    assert.equal(command.input.ConsistentRead,true);
    return {Item:{path:'a',deletedAt:'2030-01-01',enabled:false}};
  });
  const query={q:'a',match:'exact'};
  const get=async extra=>JSON.parse((await listLinks({queryStringParameters:{...query,...extra}})).body);
  assert.deepEqual((await get({})).items,[]);
  assert.equal((await get({view:'trash'})).items.length,1);
  assert.deepEqual((await get({view:'trash',state:'active'})).items,[]);
});

test('prefix search uses the path index',async t=>{
  t.mock.method(ddb,'send',async command=>{
    assert.equal(command.input.ExpressionAttributeValues[':prefix'],'aq/');
    return {Items:[]};
  });
  await listLinkRecords({limit:25,prefix:'',search:{q:'aq/',match:'prefix'}});
});
