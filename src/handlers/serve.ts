import type { Env, ImageTransformOptions, ImageResizingFormat } from '../types';
import { findKeyById, mimeFromExt, parseKey } from '../services/storage';
import { TRANSFORM_PRESETS } from '../config';
import { errorResponse } from '../utils/response';
import { parseBoolean } from '../utils/validation';

export async function handleServe(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const key = await findKeyById(env.IMAGE_BUCKET, id);
  if (!key) {
    return errorResponse('Image not found', 404);
  }

  const parsed = parseKey(key);
  if (!parsed) {
    return errorResponse('Image not found', 404);
  }

  const url = new URL(request.url);
  const enableResizing = parseBoolean(env.ENABLE_IMAGE_RESIZING, false);

  // Check for transform parameters
  const preset = url.searchParams.get('preset');
  const width = url.searchParams.get('w');
  const height = url.searchParams.get('h');
  const format = url.searchParams.get('f');
  const hasTransform = preset || width || height || format;

  if (hasTransform && enableResizing) {
    return handleTransformedImage(request, env, key, parsed.ext, url);
  }

  // Serve original from R2
  const object = await env.IMAGE_BUCKET.get(key);
  if (!object) {
    return errorResponse('Image not found', 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', mimeFromExt(parsed.ext));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.etag);

  // Check If-None-Match
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === object.etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}

async function handleTransformedImage(
  request: Request,
  env: Env,
  key: string,
  ext: string,
  url: URL
): Promise<Response> {
  // Prevent infinite loops from Image Resizing
  const via = request.headers.get('Via') || '';
  if (via.includes('image-resizing')) {
    // Serve original to the resizer
    const object = await env.IMAGE_BUCKET.get(key);
    if (!object) {
      return errorResponse('Image not found', 404);
    }
    return new Response(object.body, {
      headers: {
        'Content-Type': mimeFromExt(ext),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const options = buildTransformOptions(url);

  const baseUrl = env.BASE_URL || `https://${request.headers.get('Host') || 'localhost'}`;
  // Build a clean URL to the original image for the resizer to fetch
  const originalUrl = `${baseUrl}/images/${key.replace('images/', '')}`;

  const resizingOptions: RequestInitCfProperties = {
    image: {
      ...options,
    },
  };

  const imageRequest = new Request(originalUrl, {
    headers: request.headers,
  });

  return fetch(imageRequest, { cf: resizingOptions } as RequestInit);
}

function buildTransformOptions(url: URL): ImageTransformOptions {
  const preset = url.searchParams.get('preset');
  if (preset && TRANSFORM_PRESETS[preset]) {
    return { ...TRANSFORM_PRESETS[preset] };
  }

  const options: ImageTransformOptions = {};
  const width = url.searchParams.get('w');
  const height = url.searchParams.get('h');
  const format = url.searchParams.get('f');
  const fit = url.searchParams.get('fit') as ImageTransformOptions['fit'];

  if (width) options.width = Math.min(parseInt(width, 10) || 0, 2000);
  if (height) options.height = Math.min(parseInt(height, 10) || 0, 2000);
  const validFormats: ImageResizingFormat[] = ['webp', 'jpeg', 'png'];
  if (format && validFormats.includes(format as ImageResizingFormat)) {
    options.format = format as ImageResizingFormat;
  }
  if (fit && ['contain', 'cover', 'crop', 'scale-down'].includes(fit)) {
    options.fit = fit;
  }

  return options;
}
