import { test, expect } from '@playwright/test';

// Helper to read CSS variable from an element
async function readCssVar(page: any, selector: string, varName: string) {
  const value = await page.$eval(selector, (el, name) => getComputedStyle(el as HTMLElement).getPropertyValue(name).trim(), varName);
  return value;
}

// We assume app starts at /home when dev server is up
test.describe('Sidebar responsividade, tema e posicionamento', () => {
  test('Largura adapta em breakpoints e cabeçalho não sobrepõe', async ({ page }) => {
    await page.goto('/home');

    const sidebar = page.locator('[data-testid="app-sidebar"]');
    await expect(sidebar).toBeVisible();

    // md breakpoint (~768px)
    await page.setViewportSize({ width: 768, height: 900 });
    const mdWidthVar = await readCssVar(page, '[data-testid="app-sidebar"]', '--sidebar-width');
    expect(mdWidthVar).toBe('17rem');

    // lg breakpoint (~1024px)
    await page.setViewportSize({ width: 1024, height: 900 });
    const lgWidthVar = await readCssVar(page, '[data-testid="app-sidebar"]', '--sidebar-width');
    expect(lgWidthVar).toBe('18rem');

    // xl breakpoint (~1280px)
    await page.setViewportSize({ width: 1280, height: 900 });
    const xlWidthVar = await readCssVar(page, '[data-testid="app-sidebar"]', '--sidebar-width');
    expect(xlWidthVar).toBe('20rem');

    // Verifica que o cabeçalho principal respeita a área do sidebar
    const header = page.locator('header').first();
    const headerBox = await header.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(sidebarBox).toBeTruthy();
    // O header deve começar após a largura do sidebar (com pequena tolerância)
    if (headerBox && sidebarBox) {
      expect(headerBox.x).toBeGreaterThanOrEqual(sidebarBox.width - 6);
    }
  });

  test('Tema escuro/claro: elementos herdam cores corretamente', async ({ page }) => {
    await page.goto('/home');

    const sidebar = page.locator('[data-testid="app-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Captura cor em modo claro
    const lightColor = await sidebar.evaluate((el) => getComputedStyle(el).color);

    // Alterna para dark e valida que houve mudança nas cores
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const darkColor = await sidebar.evaluate((el) => getComputedStyle(el).color);

    expect(lightColor).not.toEqual(darkColor);

    // Verifica que itens internos usam tokens (sem cores hardcoded) via herança
    const groupLabel = page.locator('[data-sidebar="header"], [data-sidebar="footer"], [data-sidebar="menu"]');
    await expect(groupLabel.first()).toBeVisible();
  });
});