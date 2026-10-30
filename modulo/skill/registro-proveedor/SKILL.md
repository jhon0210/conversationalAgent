---
name: registro-proveedor
description: Conocimiento del proceso de registro como proveedor de Periferia IT Group: formatos de salida (xlsx, pdf, portal), estados de un campo, identificador tributario por país, soportes y reglas del paquete para firma.
---

# Conocimiento: registro como proveedor

Este documento describe el proceso. No contiene datos de la empresa: los valores solo salen de las herramientas.

## Proceso

1. Recepción deposita la solicitud del cliente (un caso en `fixtures/reto-01/casos/<caso>/`).
2. La analista pide procesar el caso. El agente lee la solicitud, mapea los campos, genera el formulario y arma el paquete.
3. El representante legal firma y la analista decide el envío. El agente nunca firma ni envía.

## Casos y formatos

- Un caso contiene la solicitud (país, cliente, formato), la plantilla y los soportes exigidos.
- `xlsx`: se escribe cada etiqueta y su valor en la hoja y celda indicadas por la plantilla.
- `pdf`: se genera un PDF con todos los campos, en el orden de la plantilla.
- `portal`: no se implementa. Se genera `valores-portal.md` con los valores para copiar. Una persona ingresa las credenciales y hace clic en "Enviar".

## Estados de un campo

- `lleno`: el valor existe en el maestro y se conoce su ruta de origen.
- `faltante`: no existe en el maestro. Se reporta; nunca se inventa.
- `requiere_confirmacion`: mapeo dudoso (confianza menor a 0.8) o regla de país (identificador extranjero, etiqueta genérica).

## Identificador tributario por país

CO usa NIT; EC, PE y PA usan RUC; HN usa RTN. Periferia solo tiene NIT colombiano.

## Soportes

Los tipos que aparecen en las solicitudes son: `camara_comercio`, `rut`, `certificacion_bancaria`, `parafiscales`, `estados_financieros`, `certificado_iso_9001` y otros que el cliente pueda exigir (por ejemplo `certificado_cumplimiento_tributario`, que puede no existir en el repositorio).

- Presente: existe en el repositorio y está vigente.
- Vencido: su vigencia terminó antes de la fecha de ejecución. Bloquea `listo_para_firma`.
- Ausente: no existe en el repositorio. Bloquea `listo_para_firma`.
- Vence pronto: vigente, pero vence en menos de 30 días. Es solo un aviso.

## Paquete para firma

`out/<caso>/paquete/` contiene el formulario, las copias de los soportes exigidos que existen, `checklist.md` y `borrador-correo.md`. El borrador de correo nunca incluye datos bancarios. "Enviar" solo escribe `out/<caso>/ENVIO-SIMULADO.md` y exige confirmación explícita.
