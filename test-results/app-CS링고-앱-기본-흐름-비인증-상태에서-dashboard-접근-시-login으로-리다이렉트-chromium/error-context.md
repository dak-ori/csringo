# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> CS링고 앱 기본 흐름 >> 비인증 상태에서 dashboard 접근 시 login으로 리다이렉트
- Location: e2e/app.spec.ts:26:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/dashboard"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - main [ref=e3]:
      - generic [ref=e4]:
        - heading "안녕하세요, 데모님!" [level=1] [ref=e5]
        - generic [ref=e6]: Lv.3
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e10]: ❤️
            - generic [ref=e11]: ❤️
            - generic [ref=e12]: ❤️
            - generic [ref=e13]: ❤️
            - generic [ref=e14]: ❤️
          - generic [ref=e15]:
            - generic [ref=e16]:
              - text: 🔥
              - strong [ref=e17]: 7일
            - generic [ref=e18]:
              - text: ⭐
              - strong [ref=e19]: 350 XP
        - generic [ref=e21]:
          - generic [ref=e22]: Lv.3
          - generic [ref=e23]: 350 / 600 XP
      - generic [ref=e26]:
        - heading "오늘의 레슨" [level=2] [ref=e27]
        - generic [ref=e28]:
          - paragraph [ref=e29]: 🎊
          - paragraph [ref=e30]: 모든 레슨을 완료했어요!
    - navigation [ref=e31]:
      - generic [ref=e32]:
        - link "홈" [ref=e33] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e34]
          - generic [ref=e37]: 홈
        - link "학습" [ref=e38] [cursor=pointer]:
          - /url: /learn
          - img [ref=e39]
          - generic [ref=e41]: 학습
        - link "복습" [ref=e42] [cursor=pointer]:
          - /url: /review
          - img [ref=e43]
          - generic [ref=e46]: 복습
        - link "프로필" [ref=e47] [cursor=pointer]:
          - /url: /profile
          - img [ref=e48]
          - generic [ref=e51]: 프로필
  - button "Open Next.js Dev Tools" [ref=e57] [cursor=pointer]:
    - img [ref=e58]
  - alert [ref=e61]
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
> 28 |     await page.waitForURL(/\/login/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
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
  40 |     await page.waitForURL(/\/login/);
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