# F1 Race OpenF1 Visualizer

Visualizador estático para GitHub Pages usando requisições diretas para a OpenF1.

## O que esta versão faz

```text
Seleciona ano
↓
Seleciona corrida
↓
Seleciona sessão
↓
Clica em Visualizar
↓
Carrega os dados históricos da sessão
↓
Roda uma simulação temporal como se fosse transmissão em tempo real
```

A simulação não cria dados falsos. Ela usa os timestamps reais da sessão histórica e libera os dados aos poucos, atualizando:

```text
mapa dos carros
standings
voltas e setores
clima
race control
pit stops
painel do piloto
telemetria do piloto clicado
rodapé de status
```

O botão muda para `Reiniciar simulação` depois do primeiro carregamento. Ao clicar novamente, a mesma sessão roda do começo sem baixar tudo outra vez.

## Estrutura final

```text
index.html
styles.css
script.js
assets/f1-car-detailed.svg
components/header.html
components/top-metrics.html
components/left-column.html
components/track-map.html
components/driver-panel.html
components/footer-status.html
js/openf1-utils.js
js/openf1-api.js
js/openf1-renderers.js
```

## Como rodar localmente

Não abra o `index.html` direto pelo explorador de arquivos. Como os componentes são carregados via `fetch`, rode um servidor local.

```bash
python -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

## Como publicar no GitHub Pages

1. Suba todos os arquivos desta pasta para a raiz do repositório.
2. Vá em `Settings > Pages`.
3. Em `Source`, selecione a branch principal e a pasta `/root`.
4. Abra o link publicado.

## Fluxo de dados

```text
Selecionar ano
↓
Buscar meetings na OpenF1
↓
Selecionar corrida
↓
Buscar sessions da corrida
↓
Selecionar sessão
↓
Buscar dados principais da sessão
↓
Buscar location histórica
↓
Iniciar simulação temporal
```

## Endpoints usados

```text
meetings
sessions
drivers
position
intervals
laps
weather
stints
pit
race_control
session_result
starting_grid
location
car_data
```

`location` é usado para posicionar os carros no mapa. Se a sessão não tiver localização disponível, o sistema usa uma distribuição visual de fallback sobre o traçado SVG.

`car_data` só é carregado quando um piloto é clicado, para evitar deixar o carregamento inicial pesado. Se a simulação estiver rodando, a telemetria carregada também passa a respeitar o tempo atual da reprodução.

## Configuração da velocidade da simulação

Ajuste no começo do `script.js`:

```js
simulationTickMs: 750,
simulationStepSeconds: 25,
```

Interpretação:

```text
A cada 750ms reais, o replay avança 25 segundos da sessão histórica.
```

Para deixar mais lento:

```js
simulationTickMs: 1000,
simulationStepSeconds: 10,
```

Para deixar mais rápido:

```js
simulationTickMs: 500,
simulationStepSeconds: 45,
```

## Arquivos removidos da versão anterior

A versão anterior misturava duas arquiteturas:

```text
index.html + components + script.js
src/ React + Vite
openf1_repo_dynamic_files/
drivers/
package.json
package-lock.json
vite.config.js
```

A versão que estava efetivamente conectada ao `index.html` era a estática. Por isso, a versão React/Vite, os mocks, as imagens locais duplicadas de pilotos e a pasta antiga de arquivos dinâmicos foram removidos.
