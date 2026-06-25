import { RouteNormalizer } from './types';

function stripQueryAndHash(value: string): string {
  var withoutHash = value.split('#')[0];
  return withoutHash.split('?')[0];
}

function extractPath(value: string): string {
  var clean = stripQueryAndHash(value || '');
  var protocolIndex = clean.indexOf('://');
  var pathStart: number;

  if (protocolIndex >= 0) {
    pathStart = clean.indexOf('/', protocolIndex + 3);
    return pathStart >= 0 ? clean.substring(pathStart) : '/';
  }

  if (clean.indexOf('//') === 0) {
    pathStart = clean.indexOf('/', 2);
    return pathStart >= 0 ? clean.substring(pathStart) : '/';
  }

  return clean || '/';
}

function looksLikeId(segment: string): boolean {
  if (/^\d+$/.test(segment)) {
    return true;
  }

  if (/^[0-9a-fA-F]{8,}$/.test(segment)) {
    return true;
  }

  if (/^[0-9a-fA-F-]{16,}$/.test(segment) && segment.indexOf('-') >= 0) {
    return true;
  }

  return false;
}

export const defaultRouteNormalizer: RouteNormalizer = function defaultRouteNormalizer(url: string): string {
  var path = extractPath(url);
  var parts = path.split('/');
  var normalized: string[] = [];
  var i: number;
  var part: string;

  for (i = 0; i < parts.length; i += 1) {
    part = parts[i];

    if (part === '') {
      if (i === 0) {
        normalized.push('');
      }
      continue;
    }

    normalized.push(looksLikeId(part) ? ':id' : part);
  }

  path = normalized.join('/');
  return path.charAt(0) === '/' ? path : '/' + path;
};
