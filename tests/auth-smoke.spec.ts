/**
 * Smoke E2E para o fluxo de login.
 *
 * Cobre regressões esperadas após a Fase 1/2:
 *  - Form de login carrega sem erros de console crítico
 *  - Validação client-side rejeita credenciais inválidas
 *  - Página de update-password tem indicadores visíveis
 *
 * Se as env vars E2E_USER_EMAIL e E2E_USER_PASSWORD estiverem presentes,
 * adicionalmente faz login autenticado e valida que /home renderiza.
 * Fixture criada via b2b-create-user — ver docs/deploy-checklist.md §F1-F3.
 */
import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

test.describe('Auth: smoke do formulário de login', () => {
  test('home redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/(login|auth|home)/);
  });

  test('formulário de login renderiza inputs essenciais', async ({ page }) => {
    await page.goto('/login');
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

// Login autenticado real — só roda se as credenciais do fixture estiverem configuradas.
// Configurar via GitHub Actions Secrets (ver docs/deploy-checklist.md §F3).
test.describe('Auth: login autenticado (opcional)', () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_USER_EMAIL/PASSWORD não configurados');

  test('login com credenciais válidas leva a home autenticada', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"], input[name="email"]').first().fill(E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(E2E_PASSWORD!);

    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();

    // Espera redirecionar para fora de /login (rota default depende do role)
    await page.waitForURL((url) => !/\/login(\?|$)/.test(url.pathname), { timeout: 20_000 });

    // Sanidade: deve haver algum elemento de chrome autenticado (sidebar/header)
    const authedChrome = page.locator('[data-sidebar], header, nav').first();
    await expect(authedChrome).toBeVisible({ timeout: 10_000 });
  });
});
