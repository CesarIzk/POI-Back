const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres POI Coach, un asistente deportivo motivacional. 
Ayudas a jugadores a mejorar su rendimiento, establecer metas y completar tareas.

IMPORTANTE: Cuando detectes que debes crear una tarea para el usuario (porque lo pide,
o porque es lógico basado en la conversación), responde con este JSON al FINAL de tu mensaje:

[TASK:{"descripcion":"<descripción clara>","valorPuntos":<número entre 5-200>,"diasLimite":<días desde hoy, entre 1-30>}]

Ejemplos de cuándo crear tareas:
- "necesito mejorar mi resistencia" → crea tarea de entrenamiento
- "quiero practicar penaltis" → crea tarea de práctica
- el usuario pide explícitamente una tarea

Si NO debes crear tarea, simplemente responde normalmente sin el bloque [TASK:...].
Responde siempre en español, de forma motivacional y concisa (máx 3 párrafos).`;

// ─── POST /api/coach/message ────────────────────────────────
// Envía mensaje al coach IA, que puede crear tareas automáticamente
router.post("/message", auth, async (req, res) => {
    const idUsuario = req.usuario.id;
    const { mensaje, idChat, historial = [] } = req.body;

    if (!mensaje?.trim()) {
        return res.status(400).json({ success: false, message: "Mensaje vacío" });
    }

    try {
        // Construir historial para Claude
        const messages = [
            ...historial.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            })),
            { role: "user", content: mensaje }
        ];

        const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages
        });

        const textoCompleto = response.content[0].text;

        // Extraer bloque [TASK:...] si existe
        const taskMatch = textoCompleto.match(/\[TASK:(\{.*?\})\]/s);
        let tareaCreada = null;
        let textoLimpio = textoCompleto.replace(/\[TASK:\{.*?\}\]/s, "").trim();

        if (taskMatch) {
            try {
                const taskData = JSON.parse(taskMatch[1]);
                const fechaLimite = new Date();
                fechaLimite.setDate(fechaLimite.getDate() + (taskData.diasLimite || 7));
                const fechaStr = fechaLimite.toISOString().split("T")[0];

                // Crear tarea usando el SP
                const [result] = await db.execute(
                    "CALL SP_GestionarTarea('INSERT', NULL, ?, ?, ?, ?, FALSE, ?)",
                    [idChat || null, idUsuario, taskData.descripcion, fechaStr, taskData.valorPuntos || 10]
                );

                const nuevaId = result[0]?.[0]?.NuevaIdTarea;
                tareaCreada = {
                    IdTarea: nuevaId,
                    Descripcion: taskData.descripcion,
                    ValorPuntos: taskData.valorPuntos || 10,
                    FechaLimite: fechaStr,
                    Estatus: false
                };
            } catch (parseErr) {
                console.error("[coach] Error parseando/creando tarea:", parseErr);
            }
        }

        return res.json({
            success: true,
            respuesta: textoLimpio,
            tareaCreada  // null si no se creó ninguna
        });

    } catch (err) {
        console.error("[POST coach/message]", err);
        return res.status(500).json({ success: false, message: "Error al contactar al coach" });
    }
});

// ─── POST /api/coach/tarea ──────────────────────────────────
// Crea una tarea manualmente desde el sidebar
router.post("/tarea", auth, async (req, res) => {
    const idUsuario = req.usuario.id;
    const { descripcion, valorPuntos = 10, diasLimite = 7, idChat = null } = req.body;

    if (!descripcion?.trim()) {
        return res.status(400).json({ success: false, message: "La descripción es obligatoria" });
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + diasLimite);
    const fechaStr = fechaLimite.toISOString().split("T")[0];

    try {
        const [result] = await db.execute(
            "CALL SP_GestionarTarea('INSERT', NULL, ?, ?, ?, ?, FALSE, ?)",
            [idChat, idUsuario, descripcion.trim(), fechaStr, valorPuntos]
        );

        const nuevaId = result[0]?.[0]?.NuevaIdTarea;
        return res.json({
            success: true,
            tarea: {
                IdTarea: nuevaId,
                Descripcion: descripcion.trim(),
                ValorPuntos: valorPuntos,
                FechaLimite: fechaStr,
                Estatus: false
            }
        });
    } catch (err) {
        console.error("[POST coach/tarea]", err);
        return res.status(500).json({ success: false, message: "Error al crear tarea" });
    }
});

module.exports = router;