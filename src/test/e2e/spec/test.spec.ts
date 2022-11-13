describe('test', () => {
  it('is website loaded', () => {
    cy.visit('localhost:3000');

    cy.get('.Home_title__T09hD')
      .should('be.visible');
  });
});
