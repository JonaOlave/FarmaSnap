import { dimensionesDestino, LADO_RECETA } from '../dimensiones';

describe('dimensionesDestino', () => {
  it('limita el lado mayor a 1000 px', () => {
    expect(dimensionesDestino(3000, 4000)).toEqual({ height: 1000 });
    expect(dimensionesDestino(4000, 3000)).toEqual({ width: 1000 });
  });

  it('no agranda fotos pequeñas', () => {
    expect(dimensionesDestino(800, 600)).toEqual({ width: 800 });
  });

  it('permite un lado mayor para recetas', () => {
    expect(dimensionesDestino(3000, 4000, LADO_RECETA)).toEqual({ height: 1568 });
  });
});
