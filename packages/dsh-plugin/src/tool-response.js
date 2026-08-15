/**
 * Pure JSON construction for the `skill_gateway` tool result.
 *
 * DSH tool outputs must be lossless JSON values. JavaScript `undefined`
 * object members are therefore never emitted; optional fields are added only
 * when they have a value.
 */

export function buildGatewayToolResponse(action, result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      action,
      error: result && result.error ? result.error : '调用失败。',
      usageRecorded: false,
    };
  }

  if (action === 'load') {
    const payload = { skillName: result.skillName, files: result.files || {} };
    if (result.scenePath) payload.scenePath = result.scenePath;
    return { ok: true, action, result: payload, usageRecorded: true };
  }

  return { ok: true, action, result, usageRecorded: false };
}
