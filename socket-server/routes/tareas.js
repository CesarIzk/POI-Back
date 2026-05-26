const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");

const MINUTOS_BLOQUEO = 20;

// ─── GET /api/tareas/:idUsuario ─────────────────────────────
router.get("/:idUsuario", auth, async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const [rows] = await db.execute(
            "CALL SP_GestionarTarea('SELECT', NULL, NULL, ?, NULL, NULL, NULL, NULL)",
            [idUsuario]
        );

        // Anotar si cada tarea ya está bloqueada (no se puede desmarcar)
        const ahora = Date.now();
        const tareas = (rows[0] || []).map(t => {
            const bloqueada = t.Estatus && t.FechaFin
                ? (ahora - new Date(t.FechaFin).getTime()) > MINUTOS_BLOQUEO * 60 * 1000
                : false;
            return { ...t, Bloqueada: bloqueada };
        });

        return res.json({ success: true, tareas });
    } catch (err) {
        console.error("[GET tareas]", err);
        return res.status(500).json({ success: false, message: "Error al obtener tareas" });
    }
});

// ─── PUT /api/tareas/:idTarea ───────────────────────────────
router.put("/:idTarea", auth, async (req, res) => {
    const idUsuario   = req.usuario.id;
    const { idTarea } = req.params;
    const { estatus } = req.body;

    if (estatus === undefined) {
        return res.status(400).json({ success: false, message: "Falta el campo estatus" });
    }

    try {
        // 1. Obtener estado actual de la tarea
        const [tareaRows] = await db.execute(
            "CALL SP_GestionarTarea('SELECT', ?, NULL, NULL, NULL, NULL, NULL, NULL)",
            [idTarea]
        );
        const tarea = tareaRows[0]?.[0];

        if (!tarea) {
            return res.status(404).json({ success: false, message: "Tarea no encontrada" });
        }

        // 2. Validar bloqueo: si ya estaba completada y pasaron +20 min, no se puede desmarcar
        if (!estatus && tarea.Estatus && tarea.FechaFin) {
            const minutosTranscurridos = (Date.now() - new Date(tarea.FechaFin).getTime()) / 60000;
            if (minutosTranscurridos > MINUTOS_BLOQUEO) {
                return res.status(403).json({
                    success: false,
                    bloqueada: true,
                    message: `No puedes desmarcar esta tarea después de ${MINUTOS_BLOQUEO} minutos`
                });
            }
        }

        // 3. Actualizar estatus en BD
        await db.execute(
            "CALL SP_GestionarTarea('UPDATE', ?, NULL, NULL, NULL, NULL, ?, NULL)",
            [idTarea, estatus ? 1 : 0]
        );

        let expResultado = null;

        // 4. Si se completó → sumar EXP
        if (estatus && tarea.ValorPuntos) {
            const [expRows] = await db.execute(
                "CALL SP_SumarExpUsuario(?, ?)",
                [idUsuario, tarea.ValorPuntos]
            );
            expResultado = expRows[0]?.[0];

            // 5. Emitir EXP por socket en tiempo real
            const io = req.app.get("io");
            if (io && expResultado) {
                io.to(`user_${idUsuario}`).emit("expActualizada", expResultado);

                if (expResultado.SubioRango) {
                    io.to(`user_${idUsuario}`).emit("subioDERango", {
                        idRango:     expResultado.IdRango,
                        nombreRango: expResultado.NombreRango,
                        puntos:      expResultado.PuntosActuales
                    });
                }
            }
        }

        return res.json({
            success: true,
            message: "Tarea actualizada",
            exp: expResultado
        });

    } catch (err) {
        console.error("[PUT tarea]", err);
        return res.status(500).json({ success: false, message: "Error al actualizar tarea" });
    }
});

module.exports = router;