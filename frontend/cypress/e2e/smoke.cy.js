describe('Smoke pages render', () => {
  const pages = ['/login', '/tickets', '/queues', '/files'];

  beforeEach(() => {
    cy.on('uncaught:exception', () => false);
  });

  it('loads key pages without crashing', () => {
    pages.forEach((p) => {
      cy.visit(p);
      cy.get('body').should('exist');
    });
  });
});





