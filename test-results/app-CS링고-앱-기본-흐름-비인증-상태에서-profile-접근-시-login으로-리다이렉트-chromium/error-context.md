# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> CS링고 앱 기본 흐름 >> 비인증 상태에서 profile 접근 시 login으로 리다이렉트
- Location: e2e/app.spec.ts:38:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/profile"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - main [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: 데
        - generic [ref=e6]:
          - heading "데모" [level=1] [ref=e7]
          - paragraph [ref=e8]: 🥈 실버
      - generic [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Lv.3
          - paragraph [ref=e12]: 레벨
        - generic [ref=e13]:
          - paragraph [ref=e14]: "350"
          - paragraph [ref=e15]: 총 XP
        - generic [ref=e16]:
          - paragraph [ref=e17]: "3"
          - paragraph [ref=e18]: 완료 레슨
        - generic [ref=e19]:
          - paragraph [ref=e20]: ❤️❤️❤️❤️❤️
          - paragraph [ref=e21]: 현재 하트
        - generic [ref=e22]:
          - paragraph [ref=e23]: 7일
          - paragraph [ref=e24]: 스트릭
        - generic [ref=e25]:
          - paragraph [ref=e26]: "#1"
          - paragraph [ref=e27]: 리그 순위
      - generic [ref=e28]:
        - heading "🥈 실버 순위" [level=2] [ref=e29]
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - generic [ref=e33]: "#1"
              - generic [ref=e34]: 데모
              - generic [ref=e35]: (나)
            - generic [ref=e36]: 350 XP
          - generic [ref=e37]:
            - generic [ref=e38]:
              - generic [ref=e39]: "#2"
              - generic [ref=e40]: 철수
            - generic [ref=e41]: 280 XP
          - generic [ref=e42]:
            - generic [ref=e43]:
              - generic [ref=e44]: "#3"
              - generic [ref=e45]: 영희
            - generic [ref=e46]: 210 XP
      - button "로그아웃" [ref=e48]
    - navigation [ref=e49]:
      - generic [ref=e50]:
        - link "홈" [ref=e51] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e52]
          - generic [ref=e55]: 홈
        - link "학습" [ref=e56] [cursor=pointer]:
          - /url: /learn
          - img [ref=e57]
          - generic [ref=e59]: 학습
        - link "복습" [ref=e60] [cursor=pointer]:
          - /url: /review
          - img [ref=e61]
          - generic [ref=e64]: 복습
        - link "프로필" [ref=e65] [cursor=pointer]:
          - /url: /profile
          - img [ref=e66]
          - generic [ref=e69]: 프로필
  - button "Open Next.js Dev Tools" [ref=e75] [cursor=pointer]:
    - img [ref=e76]
  - alert [ref=e79]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('CS링고 앱 기본 흐름', () => {
  4  | 
  5  |   test('루트 경로 접근 시 동작 확인', async ({ page }) => {
  6  |     const response = await page.goto('/');
  7  |     // 루트는 /login 또는 /dashboard로 리다이렉트되어야 함
  8  |     await page.waitForURL(/\/(login|dashboard)/);
  9  |     const url = page.url();
  10 |     expect(url).toMatch(/\/(login|dashboard)/);
  11 |   });
  12 | 
  13 |   test('로그인 페이지 렌더링', async ({ page }) => {
  14 |     await page.goto('/login');
  15 |     await expect(page.locator('h1')).toContainText('CS링고');
  16 |     await expect(page.locator('text=CS 기초, 이제 5분씩 쌓는다')).toBeVisible();
  17 |   });
  18 | 
  19 |   test('로그인 버튼 존재 확인', async ({ page }) => {
  20 |     await page.goto('/login');
  21 |     // Google 로그인 버튼 찾기
  22 |     const loginBtn = page.locator('button').first();
  23 |     await expect(loginBtn).toBeVisible();
  24 |   });
  25 | 
  26 |   test('비인증 상태에서 dashboard 접근 시 login으로 리다이렉트', async ({ page }) => {
  27 |     await page.goto('/dashboard');
  28 |     await page.waitForURL(/\/login/);
  29 |     expect(page.url()).toContain('/login');
  30 |   });
  31 | 
  32 |   test('비인증 상태에서 learn 접근 시 login으로 리다이렉트', async ({ page }) => {
  33 |     await page.goto('/learn');
  34 |     await page.waitForURL(/\/login/);
  35 |     expect(page.url()).toContain('/login');
  36 |   });
  37 | 
  38 |   test('비인증 상태에서 profile 접근 시 login으로 리다이렉트', async ({ page }) => {
  39 |     await page.goto('/profile');
> 40 |     await page.waitForURL(/\/login/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  41 |     expect(page.url()).toContain('/login');
  42 |   });
  43 | 
  44 |   test('비인증 상태에서 review 접근 시 login으로 리다이렉트', async ({ page }) => {
  45 |     await page.goto('/review');
  46 |     await page.waitForURL(/\/login/);
  47 |     expect(page.url()).toContain('/login');
  48 |   });
  49 | 
  50 |   test('auth 에러 파라미터 표시 확인', async ({ page }) => {
  51 |     await page.goto('/login?error=auth_failed');
  52 |     await expect(page.locator('text=로그인에 실패했습니다')).toBeVisible();
  53 |   });
  54 | 
  55 |   test('존재하지 않는 페이지 - 404 처리', async ({ page }) => {
  56 |     const response = await page.goto('/nonexistent-page-xyz');
  57 |     // Next.js 404 또는 리다이렉트
  58 |     expect([200, 404]).toContain(response?.status());
  59 |   });
  60 | 
  61 | });
  62 | 
```