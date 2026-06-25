import { defaultRouteNormalizer } from '../core/routeNormalizer';

describe('defaultRouteNormalizer', function () {
  it('removes query strings and masks numeric ids', function () {
    expect(defaultRouteNormalizer('/api/users/123/orders?token=abc')).toBe('/api/users/:id/orders');
  });

  it('extracts the path from absolute URLs', function () {
    expect(defaultRouteNormalizer('https://example.com/api/users/abc123ff/orders#x')).toBe(
      '/api/users/:id/orders'
    );
  });
});
