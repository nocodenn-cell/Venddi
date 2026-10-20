import { test, expect } from '@playwright/test';

test.describe('Fluxo de Login e Autenticação', () => {
  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.goto('/login');
    
    // Preencher formulário
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    
    // Clicar em entrar
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForURL('**/app/**');
    
    // Verificar se está logado
    await expect(page.locator('text=Bem-vindo')).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'invalid@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Verificar mensagem de erro
    await expect(page.locator('text=credenciais')).toBeVisible();
  });

  test('deve fazer logout corretamente', async ({ page }) => {
    // Login primeiro
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
    
    // Fazer logout
    await page.click('text=Sair');
    
    // Verificar redirecionamento para login
    await page.waitForURL('**/login');
  });
});

test.describe('Fluxo de Cadastro e Trial', () => {
  test('deve criar nova conta com trial de 30 dias', async ({ page }) => {
    await page.goto('/cadastro');
    
    // Preencher formulário
    await page.fill('input[name="fullName"]', 'Novo Usuário');
    await page.fill('input[name="email"]', `teste${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.fill('input[name="companyName"]', 'Loja Teste');
    await page.fill('input[name="cnpj"]', '12.345.678/0001-90');
    
    // Submeter
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForURL('**/app/**');
    
    // Verificar banner de trial
    await expect(page.locator('text=30 dias')).toBeVisible();
  });
});

test.describe('Fluxo de Produtos', () => {
  test.beforeEach(async ({ page }) => {
    // Login antes de cada teste
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve criar novo produto', async ({ page }) => {
    await page.goto('/app/produtos');
    
    // Clicar em novo produto
    await page.click('text=Novo Produto');
    
    // Preencher formulário
    await page.fill('input[name="name"]', 'Produto Teste');
    await page.fill('input[name="sku"]', `TEST-${Date.now()}`);
    await page.fill('input[name="costPrice"]', '25.00');
    await page.fill('input[name="sellPrice"]', '50.00');
    await page.fill('input[name="stockQuantity"]', '100');
    
    // Salvar
    await page.click('text=Salvar');
    
    // Verificar se produto aparece na lista
    await expect(page.locator('text=Produto Teste')).toBeVisible();
  });

  test('deve calcular margem corretamente', async ({ page }) => {
    await page.goto('/app/produtos');
    
    // Criar produto
    await page.click('text=Novo Produto');
    await page.fill('input[name="name"]', 'Produto Margem');
    await page.fill('input[name="sku"]', `MARG-${Date.now()}`);
    await page.fill('input[name="costPrice"]', '60.00');
    await page.fill('input[name="sellPrice"]', '100.00');
    await page.fill('input[name="stockQuantity"]', '50');
    await page.click('text=Salvar');
    
    // Verificar margem calculada (40%)
    await expect(page.locator('text=40%')).toBeVisible();
  });
});

test.describe('Fluxo de Atacado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve configurar faixas de atacado', async ({ page }) => {
    await page.goto('/app/produtos');
    
    // Criar produto
    await page.click('text=Novo Produto');
    await page.fill('input[name="name"]', 'Produto Atacado');
    await page.fill('input[name="sku"]', `ATAC-${Date.now()}`);
    await page.fill('input[name="costPrice"]', '20.00');
    await page.fill('input[name="sellPrice"]', '50.00');
    await page.fill('input[name="stockQuantity"]', '200');
    await page.click('text=Salvar');
    
    // Editar produto para adicionar faixas
    await page.click('text=Editar');
    
    // Adicionar faixa 1
    await page.click('text=Adicionar Faixa');
    await page.fill('input[name="minQuantity"]', '6');
    await page.fill('input[name="unitPrice"]', '45.00');
    await page.click('text=Adicionar');
    
    // Adicionar faixa 2
    await page.click('text=Adicionar Faixa');
    await page.fill('input[name="minQuantity"]', '12');
    await page.fill('input[name="unitPrice"]', '40.00');
    await page.click('text=Adicionar');
    
    // Salvar
    await page.click('text=Salvar');
    
    // Verificar faixas
    await expect(page.locator('text=6+')).toBeVisible();
    await expect(page.locator('text=12+')).toBeVisible();
  });
});

test.describe('Fluxo de Caixa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve abrir caixa', async ({ page }) => {
    await page.goto('/app/caixas');
    
    // Clicar em abrir caixa
    await page.click('text=Abrir Caixa');
    
    // Informar valor inicial
    await page.fill('input[name="initialAmount"]', '100.00');
    
    // Confirmar
    await page.click('text=Confirmar');
    
    // Verificar caixa aberto
    await expect(page.locator('text=Caixa Aberto')).toBeVisible();
    await expect(page.locator('text=R$ 100,00')).toBeVisible();
  });
});

test.describe('Fluxo de Venda no PDV', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve realizar venda simples', async ({ page }) => {
    // Abrir caixa primeiro
    await page.goto('/app/caixas');
    await page.click('text=Abrir Caixa');
    await page.fill('input[name="initialAmount"]', '100.00');
    await page.click('text=Confirmar');
    
    // Ir para PDV
    await page.goto('/app/pdv');
    
    // Buscar produto
    await page.fill('input[placeholder*="Buscar"]', 'Produto');
    
    // Adicionar ao carrinho
    await page.click('text=Produto >> nth=0');
    
    // Finalizar venda
    await page.click('text=Finalizar Venda');
    
    // Selecionar pagamento
    await page.click('text=Dinheiro');
    
    // Confirmar
    await page.click('text=Confirmar');
    
    // Verificar sucesso
    await expect(page.locator('text=Venda finalizada')).toBeVisible();
  });

  test('deve aplicar preço de atacado automaticamente', async ({ page }) => {
    await page.goto('/app/pdv');
    
    // Buscar produto com atacado
    await page.fill('input[placeholder*="Buscar"]', 'Atacado');
    
    // Adicionar 10 unidades (deve aplicar faixa 6+)
    await page.click('text=Produto Atacado');
    await page.click('text=+ >> nth=0'); // Aumentar quantidade
    
    // Verificar preço de atacado aplicado
    await expect(page.locator('text=Atacado aplicado')).toBeVisible();
  });
});

test.describe('Fluxo de Cancelamento', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve cancelar venda com estorno', async ({ page }) => {
    await page.goto('/app/vendas');
    
    // Localizar venda
    await page.click('text=Cancelar >> nth=0');
    
    // Informar motivo
    await page.fill('textarea', 'Cancelamento de teste para validação');
    
    // Confirmar
    await page.click('text=Confirmar Cancelamento');
    
    // Verificar cancelamento
    await expect(page.locator('text=Cancelada')).toBeVisible();
  });
});

test.describe('Dashboard e Relatórios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
  });

  test('deve exibir dashboard com dados', async ({ page }) => {
    await page.goto('/app/gestao');
    
    // Verificar gráficos
    await expect(page.locator('text=Tendência de Vendas')).toBeVisible();
    
    // Verificar alertas
    await expect(page.locator('text=Alertas')).toBeVisible();
    
    // Verificar filtros
    await expect(page.locator('select')).toBeVisible();
  });
});

test.describe('Usabilidade e UX', () => {
  test('deve ter navegação por teclado no PDV', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@venddi.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**');
    
    await page.goto('/app/pdv');
    
    // Testar atalho F3 (buscar)
    await page.keyboard.press('F3');
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeFocused();
    
    // Testar atalho ESC (limpar busca)
    await page.keyboard.press('Escape');
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/login');
    
    // Verificar se layout se adapta
    await expect(page.locator('form')).toBeVisible();
    
    // Verificar se botões são clicáveis
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
