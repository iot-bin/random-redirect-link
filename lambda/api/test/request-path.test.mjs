import assert from 'node:assert/strict';
import test from 'node:test';
import { requestPath } from '../src/link-path.mjs';
test('normalizes a named HTTP API stage only for the direct execute-api endpoint', () => {
  const event = { version:'2.0',rawPath:'/dev/links/a%20b',requestContext:{stage:'dev',domainName:'abc123.execute-api.ap-southeast-1.amazonaws.com'} };
  assert.equal(requestPath(event),'/links/a%20b');
  assert.equal(requestPath({...event,rawPath:'/dev'}),'/');
  assert.equal(requestPath({...event,rawPath:'/device/links'}),'/device/links');
  assert.equal(requestPath({...event,requestContext:{...event.requestContext,stage:'$default'}}),'/dev/links/a%20b');
  assert.equal(requestPath({...event,requestContext:{...event.requestContext,domainName:'links.example.com'}}),'/dev/links/a%20b');
  assert.equal(requestPath({...event,version:'1.0'}),'/dev/links/a%20b');
});
