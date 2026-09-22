const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('../lambda/control/node_modules/esbuild');

function fixture() {
  const calls = [];
  const modules = {};
  const context = vm.createContext({ URL, URLSearchParams });
  function load(name) {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === '@/lib/admin-api') return { forwardAdminRequest: input => { calls.push(input); return Response.json({items:[],nextCursor:null}); } };
    if (modules[name]) return modules[name];
    const file = name === 'route' ? 'app/api/links/route.ts' : name.replace('@/', '') + '.ts';
    const code = transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
    const module = {exports:{}};
    vm.runInContext(`(function(require,exports,module){${code}\n})`,context)(load,module.exports,module);
    return modules[name] = module.exports;
  }
  return {calls,get:query=>load('route').GET(new Request('https://console.example.com/api/links?'+new URLSearchParams(query)))};
}

test('list route forwards all search options and preserves literal URL characters', async()=>{
  const f=fixture();
  const input={targetId:'test',q:'https://example.com/a?x=1&y=2',match:'contains',state:'active',sort:'path-desc',view:'trash',limit:'10'};
  assert.equal(f.get(input).status,200);
  const forwarded=new URL('https://backend.example.com'+f.calls[0].endpoint).searchParams;
  for(const key of ['q','match','state','sort','view','limit'])assert.equal(forwarded.get(key),input[key]);
  assert.equal(f.calls[0].targetId,'test');
});

test('bad search input is rejected before forwarding',async()=>{
  for(const query of [{q:'a'.repeat(513)},{q:'a\nb'},{match:'regex'},{state:'unknown'},{sort:'createdAt'}]){
    const f=fixture();const response=f.get(query);
    assert.equal(response.status,400);
    assert.equal((await response.json()).code,'INVALID_SEARCH');
    assert.equal(f.calls.length,0);
  }
});

test('legacy prefix clients retain the old query shape and cursor',()=>{
  const f=fixture();f.get({prefix:'/download/',cursor:'abc123'});
  const forwarded=new URL('https://backend.example.com'+f.calls[0].endpoint).searchParams;
  assert.equal(forwarded.get('prefix'),'download/');
  assert.equal(forwarded.get('cursor'),'abc123');
  for(const key of ['q','match','state','sort'])assert.equal(forwarded.has(key),false);
});
