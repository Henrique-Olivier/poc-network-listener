"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRouteNormalizer = void 0;
function stripQueryAndHash(value) {
    var withoutHash = value.split('#')[0];
    return withoutHash.split('?')[0];
}
function extractPath(value) {
    var clean = stripQueryAndHash(value || '');
    var protocolIndex = clean.indexOf('://');
    var pathStart;
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
function looksLikeId(segment) {
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
var defaultRouteNormalizer = function defaultRouteNormalizer(url) {
    var path = extractPath(url);
    var parts = path.split('/');
    var normalized = [];
    var i;
    var part;
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
exports.defaultRouteNormalizer = defaultRouteNormalizer;
