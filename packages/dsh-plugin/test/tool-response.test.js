import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGatewayToolResponse } from '../src/tool-response.js';

function losslessRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test('load response omits undefined scenePath and error fields', () => {
  const response = buildGatewayToolResponse('load', {
    ok: true,
    skillName: 'frontend-design',
    files: { 'SKILL.md': '# frontend' },
    usageRecorded: true,
  });
  assert.deepEqual(losslessRoundTrip(response), response);
  assert.equal('scenePath' in response.result, false);
  assert.equal('error' in response, false);
  assert.equal(response.result.files['SKILL.md'], '# frontend');
});

test('load response includes scenePath only when present', () => {
  const response = buildGatewayToolResponse('load', {
    ok: true,
    skillName: 'frontend-design',
    scenePath: '工作台 / 前端设计',
    files: { 'SKILL.md': '# frontend' },
  });
  assert.deepEqual(losslessRoundTrip(response), response);
  assert.equal(response.result.scenePath, '工作台 / 前端设计');
});

test('failed responses are lossless JSON too', () => {
  const response = buildGatewayToolResponse('load', { ok: false, error: '技能不存在：x' });
  assert.deepEqual(losslessRoundTrip(response), response);
  assert.equal(response.error, '技能不存在：x');
});
