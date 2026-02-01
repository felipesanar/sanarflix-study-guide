-- Remover features descontinuadas da tabela ies_features
DELETE FROM ies_features 
WHERE feature_key IN ('enamed', 'cronogramaEnamed', 'intensivoUSCS');