# Integração local de dados F1

Pacote adaptado para consumir a base enviada sem depender da OpenF1.

## Fontes conectadas

- `race_replay_index.parquet`: 1,171 corridas de 1950 a 2026
- `race_participants.parquet`: 27,326 participações
- `lap_model.parquet`: 1,435,449 voltas modeladas
- `race_timeline_events.parquet`: 1,512,316 eventos de timeline

## Estratégia

- Índices leves em `data/normalized/*_master.json`.
- Arquivos por corrida em `data/normalized/sessions/*.json`.
- Carregamento sob demanda da sessão selecionada via `data/normalized/index.json`.
- `script.js` não chama localização/car_data externos.
- Renderização usa a última volta modelada para atualizar posições quando não houver `positions/location`.

## Observação

O mapa usa o fallback SVG atual. As voltas e posições são atualizadas pela simulação local; layouts reais podem ser conectados depois pela chave `circuit_id`/`race_id`.
