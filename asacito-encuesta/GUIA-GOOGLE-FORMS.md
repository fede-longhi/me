# Encuesta Asacito — Guía para Google Forms

Si preferís Google Forms (respuestas en una planilla automática), seguí estos pasos. Las preguntas están listas para copiar y pegar.

## 1. Crear el formulario

1. Entrá a [forms.google.com](https://forms.google.com)
2. **Formulario en blanco**
3. Título: **Encuesta de satisfacción — Asacito**
4. Descripción:

   > ¡Gracias por elegirnos! Tu opinión nos ayuda a seguir mejorando cada asado. Tarda menos de 3 minutos.

5. En ⚙️ **Configuración**:
   - Activá **Recopilar direcciones de correo electrónico** → *Opcional* (o dejalo desactivado)
   - Activá **Limitar a 1 respuesta** solo si usás cuenta Google obligatoria
6. En **Respuestas** → creá un vínculo a **Hoja de cálculo de Google** para ver todo en Excel/Sheets

## 2. Personalización visual

- Tema: color naranja/carbón (🔥 estética asado)
- Imagen de encabezado: foto de un asado o del parrillero (opcional)
- Preguntas obligatorias marcadas con asterisco

---

## 3. Preguntas (en este orden)

### Sección: Datos (opcional)

| Tipo | Pregunta | Opciones |
|------|----------|----------|
| Respuesta corta | Nombre | No obligatoria |
| Respuesta corta | WhatsApp o email | No obligatoria. Descripción: *Opcional. No lo compartimos.* |
| Fecha | Fecha del asado | No obligatoria |

---

### Sección: Experiencia general

| Tipo | Pregunta | Escala |
|------|----------|--------|
| Escala lineal | ¿Qué tan satisfecho/a quedaste con Asacito? | 1 (Muy mal) → 5 (Excelente) · **Obligatoria** |
| Escala lineal | Del 0 al 10, ¿qué tan probable es que recomiendes Asacito? | 0 → 10 · **Obligatoria** |

> La segunda pregunta es tu **NPS** (Net Promoter Score).  
> Promotores: 9–10 · Pasivos: 7–8 · Detractores: 0–6

---

### Sección: La comida

Todas **escala 1–5**, obligatorias:

1. Calidad de las carnes y productos  
2. Punto de cocción  
3. Sabor general  
4. Cantidad / porciones  

Etiquetas sugeridas: 1 = Muy mal · 5 = Excelente

---

### Sección: El asador y el servicio

Todas **escala 1–5**, obligatorias:

1. Puntualidad  
2. Trato y cordialidad  
3. Profesionalismo (organización, limpieza, presentación)  
4. Comunicación antes del evento  

---

### Sección: Valor y recomendación

| Tipo | Pregunta | Opciones |
|------|----------|----------|
| Escala 1–5 | Relación precio / calidad | Obligatoria |
| Opción múltiple | ¿Volverías a contratar a Asacito? | Sí, seguro / Probablemente / No estoy seguro/a / No |
| Lista desplegable | ¿Qué tipo de evento fue? | Reunión familiar / Cumpleaños / Evento con amigos / Empresa / corporativo / Otro |

---

### Sección: ¿Cómo nos conociste?

| Tipo | Pregunta | Opciones |
|------|----------|----------|
| Opción múltiple | ¿Cómo nos conociste? | Instagram / Recomendación / WhatsApp / Ya los conocía / Otro |

---

### Sección: Tu opinión

| Tipo | Pregunta | Obligatoria |
|------|----------|-------------|
| Párrafo | ¿Qué fue lo que más te gustó? | No |
| Párrafo | ¿Qué podríamos mejorar? | No |
| Párrafo | Algo más que quieras contarnos | No |

---

## 4. Mensaje de confirmación

Texto sugerido al enviar:

> 🔥 ¡Gracias por tu tiempo! Tu opinión nos ayuda a seguir mejorando cada asado. Si querés ver más, seguinos en Instagram @asacito.

---

## 5. Compartir en Instagram

1. En Google Forms: **Enviar** → ícono de **enlace** → acortá con bit.ly o usa el link corto de Google
2. Poné el link en:
   - **Bio de Instagram** (“Dejanos tu opinión”)
   - **Historias** con sticker de enlace
   - **Mensaje directo** post-evento: *“¡Gracias por confiar en Asacito! ¿Nos das 2 minutos de feedback?”*

### Mensaje sugerido para WhatsApp / DM

```
¡Hola! 👋 Gracias por elegir Asacito para tu asado.

Nos encantaría saber cómo te fue — son 2 minutos:
[LINK DE LA ENCUESTA]

Tu opinión nos ayuda un montón. ¡Gracias! 🔥
```

---

## 6. Cómo leer los resultados

En la hoja de Google Sheets podés calcular:

- **Promedio de satisfacción** → columna “¿Qué tan satisfecho/a…?”
- **NPS** = % promotores (9–10) − % detractores (0–6)
- **Puntos débiles** → promedios más bajos en comida vs. servicio
- **Comentarios** → columna “¿Qué podríamos mejorar?”

---

## Alternativa: página web incluida

En esta carpeta tenés `index.html`, una encuesta lista para celular que envía respuestas a **federico.rlonghi@gmail.com** vía [FormSubmit](https://formsubmit.co):

1. Enviá una respuesta de prueba desde la encuesta
2. Revisá tu mail y **confirmá** el formulario (FormSubmit lo pide la primera vez)
3. Subí la carpeta a [Netlify Drop](https://app.netlify.com/drop) (gratis, arrastrá la carpeta) y compartí el link

Ambas opciones (Google Forms o HTML) usan las mismas preguntas.

---

## Pasar la encuesta a tu amigo (cuando quieras)

### Si usás Google Forms
1. En el formulario: **⋮** (menú) → **Hacer una copia** → tu amigo la crea en su cuenta, o
2. **Transferir propiedad**: ⋮ → **Transferir propiedad del formulario** → mail de tu amigo  
   (La hoja de respuestas queda en tu Drive; conviene que tu amigo cree una copia nueva vinculada a *su* planilla.)

### Si usás la página HTML (FormSubmit)
1. Abrí `index.html` y cambiá el `action` a `https://formsubmit.co/EMAIL_DE_TU_AMIGO@gmail.com`
2. Volvé a subir la carpeta a Netlify (mismo sitio o uno nuevo)
3. Tu amigo confirma su mail con la primera respuesta de prueba
4. Opcional: exportá las respuestas que ya te llegaron por mail antes del cambio

### Recomendación
Para algo temporal en tu cuenta y después en la de tu amigo, **Google Forms + transferir propiedad** suele ser más simple que la página HTML, porque no hay que redeployar ni reconfirmar FormSubmit.
