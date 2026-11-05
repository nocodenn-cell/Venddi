-- Rollback da migration 025 (view produtos_estoque_baixo).
-- Seguro: a view não guarda dados. A listagem de estoque baixo volta a ser calculada no cliente
-- somente se a versão do app anterior à 025 for reimplantada. Não rodar com o app atual sem isso.
DROP VIEW IF EXISTS produtos_estoque_baixo;
