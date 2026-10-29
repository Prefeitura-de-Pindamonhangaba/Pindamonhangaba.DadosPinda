console.error(
  "Acesso gerenciado exclusivamente no Keycloak. Configure os client roles viewer, operator e admin; não é necessário cadastro nem vínculo local.",
);
process.exitCode = 1;
