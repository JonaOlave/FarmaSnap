import { guardarConFoto } from '../cambiarFoto';

function dependencias() {
  return {
    subir: jest.fn().mockResolvedValue('nueva.jpg'),
    eliminar: jest.fn().mockResolvedValue(undefined),
    guardar: jest.fn().mockResolvedValue(undefined),
  };
}

describe('guardarConFoto', () => {
  it('sin foto nueva guarda sin tocar la foto', async () => {
    const d = dependencias();
    await guardarConFoto(null, 'vieja.jpg', d);
    expect(d.subir).not.toHaveBeenCalled();
    expect(d.guardar).toHaveBeenCalledWith(undefined);
    expect(d.eliminar).not.toHaveBeenCalled();
  });

  it('sube la nueva, guarda con su ruta y borra la anterior', async () => {
    const d = dependencias();
    await guardarConFoto('QUJD', 'vieja.jpg', d);
    expect(d.subir).toHaveBeenCalledWith('QUJD');
    expect(d.guardar).toHaveBeenCalledWith('nueva.jpg');
    expect(d.eliminar).toHaveBeenCalledWith('vieja.jpg');
  });

  it('sin foto anterior no borra nada', async () => {
    const d = dependencias();
    await guardarConFoto('QUJD', null, d);
    expect(d.eliminar).not.toHaveBeenCalled();
  });

  it('si no se puede guardar, borra la foto recién subida y conserva la anterior', async () => {
    const d = dependencias();
    const error = new Error('sin conexión');
    d.guardar.mockRejectedValue(error);
    await expect(guardarConFoto('QUJD', 'vieja.jpg', d)).rejects.toBe(error);
    expect(d.eliminar).toHaveBeenCalledTimes(1);
    expect(d.eliminar).toHaveBeenCalledWith('nueva.jpg');
  });

  it('si falla la subida no guarda', async () => {
    const d = dependencias();
    d.subir.mockRejectedValue(new Error('subida'));
    await expect(guardarConFoto('QUJD', 'vieja.jpg', d)).rejects.toThrow('subida');
    expect(d.guardar).not.toHaveBeenCalled();
  });

  it('un error al borrar la foto anterior no hace fallar el guardado', async () => {
    const d = dependencias();
    d.eliminar.mockRejectedValue(new Error('storage'));
    await expect(guardarConFoto('QUJD', 'vieja.jpg', d)).resolves.toBeUndefined();
  });
});
