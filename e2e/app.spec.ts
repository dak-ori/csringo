import { test, expect } from '@playwright/test';

test.describe('CS링고 앱 기본 흐름', () => {

  test('루트 경로 접근 시 동작 확인', async ({ page }) => {
    const response = await page.goto('/');
    // 루트는 /login 또는 /dashboard로 리다이렉트되어야 함
    await page.waitForURL(/\/(login|dashboard)/);
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test('로그인 페이지 렌더링', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('CS링고');
    await expect(page.locator('text=CS 기초, 이제 5분씩 쌓는다')).toBeVisible();
  });

  test('로그인 버튼 존재 확인', async ({ page }) => {
    await page.goto('/login');
    // Google 로그인 버튼 찾기
    const loginBtn = page.locator('button').first();
    await expect(loginBtn).toBeVisible();
  });

  test('비인증 상태에서 dashboard 접근 시 login으로 리다이렉트', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('비인증 상태에서 learn 접근 시 login으로 리다이렉트', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('비인증 상태에서 profile 접근 시 login으로 리다이렉트', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('비인증 상태에서 review 접근 시 login으로 리다이렉트', async ({ page }) => {
    await page.goto('/review');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('auth 에러 파라미터 표시 확인', async ({ page }) => {
    await page.goto('/login?error=auth_failed');
    await expect(page.locator('text=로그인에 실패했습니다')).toBeVisible();
  });

  test('존재하지 않는 페이지 - 404 처리', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz');
    // Next.js 404 또는 리다이렉트
    expect([200, 404]).toContain(response?.status());
  });

});
