# Pendiente: trazabilidad de clientes con ManyChat

## Lo que se quiere
Cuando alguien **cierra** (se convierte en cliente), poder **buscar a esa persona** y ver **de qué etiquetas vino**:
qué reel, carrusel, historia o mensaje la trajo, y en qué orden. Idealmente "dibujado" como un recorrido.

## Convención de etiquetas que ya se usa en ManyChat
- `HR` + fecha → hand raiser (levantó la mano)
- `reel` + fecha
- `carrusel` + fecha
- saludo a seguidores nuevos (bienvenida)

## Cómo se puede hacer (análisis)
- **Buscar una persona y ver sus etiquetas SÍ se puede con la API de ManyChat**, sin configurar nada en los flows:
  buscar por nombre / email / teléfono / ID → leer la ficha del contacto, que trae todas sus etiquetas.
  Como las etiquetas llevan la fecha en el nombre, se pueden ordenar y dibujar como línea de tiempo.
- Lo que la API **no** permite: listar todos los contactos, contar cuántos tienen una etiqueta o leer conversaciones.
  Para totales por contenido (cuántas personas trajo cada reel) hace falta el paso "Solicitud externa" en cada flow,
  o contar comentarios con la palabra clave desde la API de Instagram.
- Posible pantalla: buscador de persona → ficha con su recorrido (primer contacto, etiquetas en orden, tipo de cada una)
  + marcar "cerró" para después ver qué contenidos traen más clientes, no solo más mensajes.

## Duda abierta
Si conviene hacer estas métricas acá o en otra herramienta. Retomar después de configurar la app de Meta.
