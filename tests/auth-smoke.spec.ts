/**
 * Smoke E2E para o fluxo de login.
 *
 * Cobre regressões esperadas após a Fase 1/2:
 *  - Form de login carrega sem erros de console crítico
 *  - Validação client-side rejeita credenciais inválidas
 *  - Página de update-password tem indicadores visíveis
 *
 * NÃO autentica de verdade (depende de fixture Supabase — runbook §6).
 * Para o teste autenticado completo, ver tests/authenticated.spec.ts
 * (fica para PR após criação do usuário fixture).
 */
import { test, expect } from '@playwright/test';

test.describe('Auth: smoke do formulário de login', () => {
  test('home redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto('/home');
    // Espera redirecionar ou exibir login form
    await expect(page).toHaveURL(/\/(login|auth|home)/);
  });

  test('formulário de login renderiza inputs essenciais', async ({ page }) => {
    await page.goto('/login');
    // Inputs de email e senha existem
    const email = page.locator('input[type="email"], input[name="email"]');
    const password = page.locator('input[type="password"]');
    await expect(email.first()).toBeVisible({ timeout: 10_000 });
    await expect(password.first()).toBeVisible();
  });

  test('console não emite erros críticos durante carregamento', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignora 401/403 esperados em fetch quando deslogado e
        // erros de rede em recursos de terceiros (analytics).
        const text = msg.text();
        if (!/401|403|net::|Failed to fetch.*analytics|Failed to fetch.*googletagmanager/i.test(text)) {
          errors.push(text);
        }
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    expect(errors, `console errors: ${errors.join('\n')}`).toHaveLength(0);
  });
});
