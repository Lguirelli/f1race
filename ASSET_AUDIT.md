# Auditoria de assets

Versão limpa com preservação de imagens de equipes.

## Mantidos

- `assets/f1-car-detailed.svg`
- `assets/visual/drivers/*.png`
- `assets/visual/teams/*.svg`

## Removidos da versão reduzida

- imagens de circuitos duplicadas ou não chamadas diretamente pelas páginas atuais
- bandeiras por temporada
- manifestos visuais pesados
- arquivos `.csv` dentro de `assets/visual`
- versões duplicadas `_optimized` e não otimizadas fora do conjunto usado

## Observação

As imagens de equipes foram mantidas mesmo quando ainda não são chamadas diretamente pelas páginas atuais, para permitir uso futuro em cards, páginas de equipes, detalhes de pilotos e telas históricas.
