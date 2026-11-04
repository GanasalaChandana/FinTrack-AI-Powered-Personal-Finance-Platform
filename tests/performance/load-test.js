// Load test for the FinTrack API (k6: https://k6.io).
//
//   k6 run -e BASE_URL=http://localhost:8080 \
//          -e EMAIL=you@example.com -e PASSWORD=... tests/performance/load-test.js
//
// Signs in once, then each virtual user loads what the dashboard and reports
// pages load. Use a test account, and don't point it at the free Render
// instance unless you mean to: it is small and shared by real visitors.
import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export const options = {
  stages: [
    { duration: '15s', target: 5 },   // ramp up
    { duration: '45s', target: 5 },   // steady
    { duration: '15s', target: 15 },  // spike
    { duration: '30s', target: 15 },
    { duration: '15s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{page:dashboard}': ['p(95)<800'],
    'http_req_duration{page:reports}': ['p(95)<1500'],
  },
};

export function setup() {
  if (!__ENV.EMAIL || !__ENV.PASSWORD) fail('Set EMAIL and PASSWORD (a test account)');
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } });
  // The session comes back as an HttpOnly cookie; API clients may send it as a Bearer token
  const token = res.cookies.ft_at && res.cookies.ft_at[0] && res.cookies.ft_at[0].value;
  if (res.status !== 200 || !token) fail(`Login failed: HTTP ${res.status}`);
  return { headers: { Authorization: `Bearer ${token}` } };
}

export default function ({ headers }) {
  group('dashboard', () => {
    const tags = { page: 'dashboard' };
    const r = http.batch([
      ['GET', `${BASE_URL}/api/transactions`, null, { headers, tags }],
      ['GET', `${BASE_URL}/api/budgets`, null, { headers, tags }],
      ['GET', `${BASE_URL}/api/alerts`, null, { headers, tags }],
    ]);
    r.forEach((res) => check(res, { 'dashboard 200': (x) => x.status === 200 }));
  });
  sleep(1);

  group('reports', () => {
    const res = http.get(`${BASE_URL}/api/reports/financial?range=last-6-months`, { headers, tags: { page: 'reports' } });
    check(res, { 'reports 200': (x) => x.status === 200 });
  });
  sleep(2);
}
