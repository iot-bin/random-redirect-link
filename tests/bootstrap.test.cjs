const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('../lambda/control/node_modules/esbuild');
function fixture() {
  const env = { MANAGEMENT_API_URL: 'https://control.example.com' };
  let time = 1000;
  const calls = [];
  let respond = async () => Response.json({region:'ap-southeast-1',cognitoClientId:'client123',title:'Console'});
  const modules = {};
  const jar = new Map([['console-refresh', {value:'refresh-token'}]]);
  const headers = {cookies:async()=>({get:k=>jar.get(k),set:(k,v)=>jar.set(k,{value:v}),delete:k=>jar.delete(k)})};
  const context = vm.createContext({URL,Response,AbortSignal,Date:{now:()=>time},process:{env},fetch:async(...args)=>{calls.push(args);return respond(...args);}});
  function load(name) {
    if (name === 'server-only') return {};
    if (name === 'next/headers') return headers;
    name = name.replace('./','');
    if (modules[name]) return modules[name];
    const output = transformSync(fs.readFileSync(`lib/${name}.ts`,'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
    const module = {exports:{}};
    vm.runInContext(`(function(require,exports,module){${output}\n})`,context)(load,module.exports,module);
    return modules[name] = module.exports;
  }
  return {env,calls,jar,load,setTime:v=>time=v,respond:fn=>respond=fn};
}
test('rejects missing and unsafe entry points before fetching', async()=>{
  const f=fixture(), b=f.load('bootstrap');
  for(const url of ['', 'http://example.com','https://user:pass@example.com','https://example.com/?x=1','https://example.com/#x']) {
    f.env.MANAGEMENT_API_URL=url;
    await assert.rejects(b.getPublicConfiguration(), e=>e.code==='CONFIG_ERROR'&&e.status===503);
  }
  assert.equal(f.calls.length,0);
});
test('coalesces requests, expires after 60 seconds and separates endpoints', async()=>{
  const f=fixture(), b=f.load('bootstrap');
  await Promise.all([b.getPublicConfiguration(), b.getPublicConfiguration()]);
  await b.getPublicConfiguration(); assert.equal(f.calls.length,1);
  assert.equal(f.calls[0][1].redirect,'error'); assert.equal(f.calls[0][1].cache,'no-store');
  assert.equal(f.calls[0][1].headers,undefined);
  f.setTime(61000);await b.getPublicConfiguration();assert.equal(f.calls.length,2);
  f.env.MANAGEMENT_API_URL='https://other.example.com/stage/';await b.getPublicConfiguration();
  assert.equal(f.calls[2][0],'https://other.example.com/stage/public/site');
});
test('does not retain failures or use expired configuration during an outage', async()=>{
  const f=fixture(), b=f.load('bootstrap');await b.getPublicConfiguration();f.setTime(62000);
  f.respond(async()=>new Response('',{status:503}));
  await assert.rejects(b.getPublicConfiguration(),e=>e.code==='CONTROL_UNAVAILABLE');
  f.respond(async()=>Response.json({region:'ap-southeast-1',cognitoClientId:'newclient'}));
  assert.equal((await b.getPublicConfiguration()).cognitoClientId,'newclient');assert.equal(f.calls.length,3);
});
test('rejects malformed configuration and an old API without login fields', async()=>{
  for(const payload of [null, {title:'old API'}, {region:'evil.example/path',cognitoClientId:'abc'}, {region:'ap-southeast-1',cognitoClientId:'bad/id'}]) {
    const f=fixture();f.respond(async()=>Response.json(payload));
    await assert.rejects(f.load('bootstrap').getPublicConfiguration(),e=>e.code==='CONFIG_ERROR');
  }
});
test('login, challenges, recovery and revocation use discovered client; MFA omits ClientId', async()=>{
  const f=fixture();
  f.respond(async(url)=> url.endsWith('/public/site') ? Response.json({region:'ap-southeast-1',cognitoClientId:'discovered'}) : Response.json({}));
  const s=f.load('session');
  for(const op of ['InitiateAuth','RespondToAuthChallenge','ForgotPassword','ConfirmForgotPassword','RevokeToken']) {
    await s.cognito(op,{ClientId:'untrusted',Token:'test'});
    const [url,options]=f.calls.at(-1);assert.equal(url,'https://cognito-idp.ap-southeast-1.amazonaws.com/');
    assert.equal(JSON.parse(options.body).ClientId,'discovered');assert.equal(options.redirect,'error');
  }
  await s.cognito('GetUser',{AccessToken:'test'});
  assert.equal(JSON.parse(f.calls.at(-1)[1].body).ClientId,undefined);
  assert.equal(f.calls.filter(c=>c[0].endsWith('/public/site')).length,1);
});
test('session renewal discovers configuration and saves refreshed access token', async()=>{
  const f=fixture();f.respond(async url=>url.endsWith('/public/site') ? Response.json({region:'ap-southeast-1',cognitoClientId:'discovered'}) : Response.json({AuthenticationResult:{AccessToken:'renewed'}}));
  assert.equal(await f.load('session').accessToken(true),'renewed');
  const payload=JSON.parse(f.calls.at(-1)[1].body);
  assert.equal(payload.AuthFlow,'REFRESH_TOKEN_AUTH');assert.equal(payload.ClientId,'discovered');
  assert.equal(f.jar.get('console-access').value,'renewed');
});


