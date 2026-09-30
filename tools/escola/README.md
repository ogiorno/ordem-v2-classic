# Mapas da escola (3 andares)

Pipeline que gera paredes, portas, janelas e luzes a partir das imagens de 2900x2100 (100 px por quadrado).

- `floorN.py`: salas (retângulos), contorno do prédio, portas/janelas extras e pontos de início do andar N.
  As coordenadas são da imagem exibida em 2000 px de largura (andares 2 e 3) ou 1450 px (andar 1, `scale = 2.0`).
- `build.py N .`: alinha as paredes aos pixels reais da imagem, acha as lacunas (portas) e o vidro (janelas) e gera `finalN.json`.
- `reach.py N .`: confere se toda sala é alcançável por portas.
- `gen_data.py .`: junta os andares e as luzes em `escola-data.json` (copiado para `Data/assets/escola/`).
- `crop.py`: recortes ampliados com régua, para conferir à mão.

As imagens ficam em `%LOCALAPPDATA%\FoundryVTT\Data\assets\escola\`. Requer Python com numpy, scipy e Pillow.
