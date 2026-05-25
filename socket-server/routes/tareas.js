const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");

// ─── GET /api/tareas/:idUsuario ─────────────────────────────
router.get("/:idUsuario", auth, async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const [rows] = await db.execute(
            "CALL SP_GestionarTarea('SELECT', NULL, NULL, ?, NULL, NULL, NULL, NULL)",
            [idUsuario]
        );
        return res.json({ success: true, tareas: rows[0] });
    } catch (err) {
        console.error("[GET tareas]", err);
        return res.status(500).json({ success: false, message: "Error al obtener tareas" });
    }
});

// ─── PUT /api/tareas/:idTarea ───────────────────────────────
// Actualiza estatus. Si se marca como completada, suma EXP al usuario.
router.put("/:idTarea", auth, async (req, res) => {
    const idUsuario  = req.usuario.id;
    const { idTarea } = req.params;
    const { estatus } = req.body;

    if (estatus === undefined) {
        return res.status(400).json({ success: false, message: "Falta el campo estatus" });
    }

    try {
        // 1. Actualizar estatus de la tarea
        await db.execute(
            "CALL SP_GestionarTarea('UPDATE', ?, NULL, NULL, NULL, NULL, ?, NULL)",
            [idTarea, estatus ? 1 : 0]
        );

        let expResultado = null;

        // 2. Si se marcó como completada → sumar EXP
        if (estatus) {
            // Obtener los puntos de la tarea
            const [tareaRows] = await db.execute(
                "CALL SP_GestionarTarea('SELECT', ?, NULL, NULL, NULL, NULL, NULL, NULL)",
                [idTarea]
            );
            const tarea = tareaRows[0]?.[0];

            if (tarea?.ValorPuntos) {
                const [expRows] = await db.execute(
                    "CALL SP_SumarExpUsuario(?, ?)",
                    [idUsuario, tarea.ValorPuntos]
                );
                expResultado = expRows[0]?.[0];

                // Emitir por socket en tiempo real
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
        }

        return res.json({
            success: true,
            message: "Tarea actualizada",
            exp: expResultado   // null si se desmarcó, objeto con EXP si se completó
        });

    } catch (err) {
        console.error("[PUT tarea]", err);
        return res.status(500).json({ success: false, message: "Error al actualizar tarea" });
    }
});

module.exports = router;