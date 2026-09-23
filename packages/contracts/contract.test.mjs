import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isLinkBatchAction, isLinkMatch, isLinkState, isLinkSort, isLinkView,
  linkPathIssue, normalizeLinkPath, normalizeLinkPrefix, normalizePublicRequestPath,
  targetUrlIssue, splitTargetUrl, parseLinkListResponse, parseLinkBatchResponse,
  linkListResponse, linkBatchResponse, isLinkStatusCode,
} from './index.mjs';

test('link path rules keep creation and public lookup semantics distinct', () => {
  assert.equal(normalizeLinkPath(' /a/b/ '), 'a/b');
  assert.equal(linkPathIssue('a//b'), 'double_slash');
  assert.equal(linkPathIssue('../a'), 'dot_segments');
  assert.equal(linkPathIssue('a?', { prefix: true }), 'query_fragment');
  assert.equal(normalizePublicRequestPath('/%E6%B5%8B%E8%AF%95'), '测试');
  assert.equal(normalizePublicRequestPath('/%E0%A4%A'), '%E0%A4%A');
  const repeatedSlashes = '/'.repeat(50_000);
  assert.equal(normalizeLinkPath(repeatedSlashes), '');
  assert.equal(normalizeLinkPrefix(repeatedSlashes), '');
  assert.equal(normalizePublicRequestPath(repeatedSlashes), '');
  assert.equal(normalizeLinkPath(`//a/b${repeatedSlashes}`), 'a/b');
});

test('target URL rules and serialized fields agree', () => {
  assert.equal(targetUrlIssue('https://user:pass@example.com/'), 'credentials');
  assert.equal(targetUrlIssue('https://example.com/?q=1'), 'query_fragment');
  assert.deepEqual(splitTargetUrl('https://example.com/a'), {
    targetUrl: 'https://example.com/a', targetBaseUrl: 'https://example.com', targetPath: '/a',
  });
});

test('request enums and response shapes are common to producers and consumers', () => {
  assert.equal(isLinkBatchAction('restore'), true);
  assert.equal(isLinkBatchAction('archive'), false);
  assert.equal(isLinkStatusCode(302), true);
  assert.equal(isLinkStatusCode(307), false);
  assert.equal(isLinkMatch('prefix') && isLinkState('purged') && isLinkSort('path-desc') && isLinkView('trash'), true);
  assert.deepEqual(parseLinkListResponse(linkListResponse([{ path: 'a' }], null)), {
    items: [{ path: 'a' }], nextCursor: null,
  });
  assert.equal(parseLinkBatchResponse(linkBatchResponse('delete', [], [{ path: 'a', code: 'NOT_FOUND', error: 'missing' }]))?.failed[0].code, 'NOT_FOUND');
  assert.equal(parseLinkBatchResponse({ action: 'unknown', succeeded: [], failed: [] }), null);
});
