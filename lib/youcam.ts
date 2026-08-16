/**
 * YouCam (Perfect Corp) S2S API client.
 *
 * Server-side only. The API key and RSA secret must never reach the browser.
 *
 * Behaviour here follows constraints that were measured against the live API -
 * see docs/superpowers/specs/2026-08-16-drape-design.md section 2. The important
 * ones:
 *   - polling is MANDATORY; an unpolled task expires and units are still charged
 *   - a bad src_file_url still returns HTTP 200 and starts a task
 *   - failed tasks cost 0 units
 */

import crypto from "node:crypto";

const BASE = "https://yce-api-01.perfectcorp.com";

/** Thrown for any YouCam-side failure. Never collapses into an empty result. */
export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly userMessage: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "YouCamError";
  }
}

/** Quota exhaustion gets its own type so the UI can show a real banner. */
export class OutOfUnitsError extends YouCamError {
  constructor(remaining: number) {
    super(
      `insufficient units (${remaining} remaining)`,
      "out_of_units",
      "Live generation is paused — the demo API budget is exhausted.",
    );
  }
}

/**
 * Error codes -> guidance a user can act on.
 * `error_src_face_too_small` is deliberately reworded: the API returns it for
 * several distinct problems and its literal text misleads (a large, sharp face
 * still triggers it when it fills under 60% of the frame).
 */
const ERROR_GUIDANCE: Record<string, string> = {
  error_src_face_too_small:
    "Move closer — your face needs to fill about two-thirds of the photo's width.",
  error_below_min_image_size: "That image is too small. Use one at least 480px on its short side.",
  error_exceed_max_image_size: "That image is too large. Keep it under 4096px on the long side.",
  exceed_max_filesize: "That file is over 10MB. Try a smaller version.",
  error_no_face: "We couldn't find a face in that photo.",
  error_multiple_people: "Please use a photo with just one person in it.",
  error_face_position_invalid: "Your face needs to be fully visible and centred.",
  error_face_position_out_of_boundary: "Your face is cut off at the edge of the photo.",
  error_face_not_forward_facing: "Look straight into the camera.",
  error_face_angle_upward: "Tilt your head down slightly.",
  error_face_angle_downward: "Tilt your head up slightly.",
  error_face_angle_leftward: "Turn your head slightly to the right.",
  error_face_angle_rightward: "Turn your head slightly to the left.",
  error_face_angle_left_tilt: "Straighten your head — it's tilted left.",
  error_face_angle_right_tilt: "Straighten your head — it's tilted right.",
  error_pose: "Stand facing the camera, upright and unobstructed.",
  error_invalid_src: "We need a photo showing your upper body or full body.",
  error_invalid_ref: "Use a clearer photo of the garment — ideally worn, not folded.",
  error_apply_region_mismatch: "That garment doesn't match the part of the body in your photo.",
  error_download_image: "We couldn't download that image. Check the link works publicly.",
  error_nsfw_content_detected: "That image was flagged and can't be processed.",
  error_editing_failed: "The try-on came back unchanged. Try a more distinct garment.",
  error_unsupport_ratio: "That image's aspect ratio isn't supported — try a portrait crop.",
};

function guidanceFor(code: string): string {
  return ERROR_GUIDANCE[code] ?? "Something went wrong processing that image.";
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

let cachedToken: { token: string; obtainedAt: number } | null = null;
// The server does not publish a TTL; refresh well inside any plausible window
// and re-auth on 401 regardless.
const TOKEN_MAX_AGE_MS = 20 * 60 * 1000;

function credentials() {
  const key = process.env.YouCam_API_KEY;
  const secret = process.env.YouCam_SecretKey;
  if (!key || !secret) {
    throw new YouCamError(
      "YouCam_API_KEY / YouCam_SecretKey missing from the environment",
      "not_configured",
      "The server is missing its YouCam credentials.",
    );
  }
  return { key, secret };
}

async function authenticate(): Promise<string> {
  const { key, secret } = credentials();

  // The secret is a base64 DER SubjectPublicKeyInfo RSA public key.
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(secret, "base64"),
    format: "der",
    type: "spki",
  });

  const payload = `client_id=${key}&timestamp=${Date.now()}`;
  const idToken = crypto
    .publicEncrypt(
      // PKCS#1 v1.5 - NOT Node's OAEP default, which the server rejects.
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(payload, "utf8"),
    )
    .toString("base64");

  const res = await fetch(`${BASE}/s2s/v1.0/client/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: key, id_token: idToken }),
  });

  const body = (await res.json().catch(() => ({}))) as any;
  const token = body?.result?.access_token;
  if (!res.ok || !token) {
    throw new YouCamError(
      `auth failed: ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
      "auth_failed",
      "Could not connect to the YouCam API.",
    );
  }
  cachedToken = { token, obtainedAt: Date.now() };
  return token;
}

async function token(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.obtainedAt < TOKEN_MAX_AGE_MS) {
    return cachedToken.token;
  }
  return authenticate();
}

/* ------------------------------------------------------------------ */
/* Request plumbing                                                    */
/* ------------------------------------------------------------------ */

async function call<T = any>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  retryOn401 = true,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if ((res.status === 401 || res.status === 403) && retryOn401) {
    cachedToken = null;
    return call<T>(method, path, body, false);
  }

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const code = json?.error_code ?? `http_${res.status}`;
    throw new YouCamError(
      `${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`,
      code,
      guidanceFor(code),
      res.status >= 500,
    );
  }
  // Validate content, not just status: a 200 with no body is still a failure.
  if (json === null) {
    throw new YouCamError(
      `${method} ${path} returned 200 with an unreadable body`,
      "bad_response",
      "The YouCam API returned an unexpected response.",
      true,
    );
  }
  return json as T;
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

export async function remainingUnits(): Promise<number> {
  const d = await call<{ results?: { amount_dec: number }[] }>("GET", "/s2s/v1.0/client/credit");
  return (d.results ?? []).reduce((n, r) => n + r.amount_dec, 0);
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

/**
 * Two-step upload: ask for a presigned URL, then PUT the bytes to it.
 * Calling the file API alone does NOT upload anything - the docs warn that
 * skipping the PUT produces a confusing 500/404 later, not an upload error.
 */
export async function uploadImage(
  feature: string,
  bytes: Buffer | Uint8Array,
  fileName = "upload.jpg",
  contentType = "image/jpeg",
): Promise<string> {
  const buf = Buffer.from(bytes);
  const init = await call<any>("POST", `/s2s/v2.0/file/${feature}`, {
    files: [{ content_type: contentType, file_name: fileName, file_size: buf.byteLength }],
  });

  const file = init?.data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) {
    throw new YouCamError(
      `upload init returned no presigned URL: ${JSON.stringify(init).slice(0, 200)}`,
      "upload_init_failed",
      "Couldn't start the upload.",
    );
  }

  // The signature covers content-length and content-type; send them verbatim.
  const put = await fetch(request.url, {
    method: request.method ?? "PUT",
    headers: { ...(request.headers ?? {}) },
    body: buf,
  });
  if (!put.ok) {
    throw new YouCamError(
      `presigned PUT failed: ${put.status}`,
      "upload_failed",
      "Couldn't upload that image.",
      true,
    );
  }
  return file.file_id as string;
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export interface TaskResult {
  status: "success" | "error";
  results: any;
  errorCode?: string;
}

/**
 * Start a task and poll to completion.
 *
 * Polling is not optional: an unpolled task expires and the units are charged
 * anyway, so we always drive it to a terminal state.
 */
export async function runTask(
  feature: string,
  payload: Record<string, unknown>,
  { timeoutMs = 180_000, intervalMs = 2_500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<TaskResult> {
  const start = await call<any>("POST", `/s2s/v2.0/task/${feature}`, payload);
  const taskId = start?.data?.task_id;
  if (!taskId) {
    throw new YouCamError(
      `task start returned no task_id: ${JSON.stringify(start).slice(0, 200)}`,
      "task_start_failed",
      "Couldn't start that job.",
    );
  }

  const began = Date.now();
  while (Date.now() - began < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const poll = await call<any>(
      "GET",
      `/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`,
    );
    const state = poll?.data?.task_status;

    if (state === "success") {
      return { status: "success", results: poll.data.results };
    }
    if (state === "error" || state === "failed") {
      const code = poll?.data?.error ?? "unknown_error";
      // Failed tasks cost nothing, so this is safe to surface and retry.
      throw new YouCamError(`${feature} failed: ${code}`, code, guidanceFor(code));
    }
  }
  throw new YouCamError(
    `${feature} timed out after ${timeoutMs}ms`,
    "timeout",
    "That took too long — please try again.",
    true,
  );
}

/* ------------------------------------------------------------------ */
/* Feature wrappers                                                    */
/* ------------------------------------------------------------------ */

/** All 14 SD concerns. Cost is 16 units whether you ask for 1 or 14 at HD-less SD. */
export const SD_CONCERNS = [
  "wrinkle", "droopy_upper_eyelid", "droopy_lower_eyelid", "firmness",
  "acne", "moisture", "eye_bag", "dark_circle_v2", "age_spot",
  "radiance", "redness", "oiliness", "pore", "texture",
] as const;

/** Skin Analysis. Returns a URL to a ZIP containing scores and heatmap masks. */
export async function analyseSkin(fileId: string): Promise<{ zipUrl: string }> {
  const r = await runTask("skin-analysis", {
    src_file_id: fileId,
    dst_actions: [...SD_CONCERNS],
  });
  return { zipUrl: r.results.url };
}

export interface ToneResult {
  skinHex: string;
  hairHex: string;
  eyeHex: string;
  eyeName?: string;
  lipHex: string;
  eyebrowHex?: string;
  hairName?: string;
  faceQuality?: Record<string, unknown>;
}

/**
 * Facial Colour Tones.
 *
 * NOTE: `hair_color` is not trustworthy - measured returning "#FAF0BE (Blonde)"
 * for a subject with abundant dark brown hair. Callers must cross-check it.
 */
export async function analyseTone(fileId: string): Promise<ToneResult> {
  const r = await runTask("skin-tone-analysis", { src_file_id: fileId });
  const c = r.results.color ?? {};
  return {
    skinHex: c.skin_color,
    hairHex: c.hair_color,
    hairName: c.hair_color_name,
    eyeHex: c.eye_color,
    eyeName: c.eye_color_name,
    lipHex: c.lip_color,
    eyebrowHex: c.eyebrow_color,
    faceQuality: r.results.face_quality,
  };
}

export type GarmentCategory =
  | "upper_body" | "lower_body" | "full_body" | "shoes" | "outerwear" | "auto";

/**
 * Apparel try-on.
 *
 * Uses `task/cloth` (v2), not `cloth-v4`: measured hue fidelity is roughly twice
 * as good on v2 (-4 to -5 degrees vs -12), and hue is the axis that decides
 * whether a colour reads warm or cool.
 */
export async function tryOnGarment(opts: {
  personFileId: string;
  garmentFileId?: string;
  templateId?: string;
  category?: GarmentCategory;
}): Promise<{ imageUrl: string }> {
  if (!opts.garmentFileId && !opts.templateId) {
    throw new YouCamError(
      "tryOnGarment needs either garmentFileId or templateId",
      "invalid_request",
      "No garment was supplied.",
    );
  }
  const payload: Record<string, unknown> = {
    src_file_id: opts.personFileId,
    garment_category: opts.category ?? "upper_body",
  };
  if (opts.garmentFileId) payload.ref_file_id = opts.garmentFileId;
  else payload.template_id = opts.templateId;

  const r = await runTask("cloth", payload);
  const url = typeof r.results === "string" ? r.results : r.results?.url;
  if (!url) {
    throw new YouCamError(
      `try-on returned no image url: ${JSON.stringify(r.results).slice(0, 200)}`,
      "no_result_image",
      "The try-on didn't produce an image.",
    );
  }
  return { imageUrl: url };
}

export interface CatalogueItem {
  id: string;
  thumb: string;
  title: string;
  category: string;
}

export async function listGarmentTemplates(nextToken?: string): Promise<{
  items: CatalogueItem[];
  nextToken?: string;
}> {
  const q = nextToken ? `?next_token=${encodeURIComponent(nextToken)}` : "";
  const d = await call<any>("GET", `/s2s/v2.0/task/template/cloth${q}`);
  return {
    items: (d?.data?.templates ?? []).map((t: any) => ({
      id: t.id,
      thumb: t.thumb,
      title: t.title,
      category: t.category_name,
    })),
    nextToken: d?.data?.next_token,
  };
}
