// routes/usuario.js  — reemplaza el tuyo completo
const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");

// ─── GET /api/usuario/me ────────────────────────────────────
// Devuelve datos del usuario autenticado (con estado de EXP y rango)
router.get("/me", auth, async (req, res) => {
    const idUsuario = req.usuario.id;
    try {
        const [rows] = await db.execute(
            "CALL SP_ObtenerEstadoUsuario(?)",
            [idUsuario]
        );
        const estado = rows[0]?.[0];
        if (!estado) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        return res.json({ success: true, usuario: estado });
    } catch (err) {
        console.error("[GET /me]", err);
        // Fallback: devolver datos del token si el SP falla
        return res.json({ success: true, usuario: req.usuario });
    }
});

// ─── POST /api/usuario/exp ──────────────────────────────────
// Suma EXP al usuario cuando completa una tarea.
// Emite evento de socket si sube de rango.
router.post("/exp", auth, async (req, res) => {
    const idUsuario = req.usuario.id;
    const { puntos } = req.body;

    if (!puntos || isNaN(puntos) || puntos <= 0) {
        return res.status(400).json({ success: false, message: "Puntos inválidos" });
    }

    try {
        const [rows] = await db.execute(
            "CALL SP_SumarExpUsuario(?, ?)",
            [idUsuario, parseInt(puntos)]
        );

        const resultado = rows[0]?.[0];
        if (!resultado) throw new Error("SP no devolvió resultado");

        // Emitir por socket en tiempo real a la sala del usuario
        const io = req.app.get("io");
        if (io) {
            io.to(`user_${idUsuario}`).emit("expActualizada", resultado);

            if (resultado.SubioRango) {
                io.to(`user_${idUsuario}`).emit("subioDERango", {
                    idRango:     resultado.IdRango,
                    nombreRango: resultado.NombreRango,
                    puntos:      resultado.PuntosActuales
                });
            }
        }

        // Actualizar localStorage con los nuevos puntos (lo devolvemos al front)
        return res.json({
            success: true,
            ...resultado   // PuntosActuales, IdRango, NombreRango, SubioRango, PuntosSiguienteRango
        });

    } catch (err) {
        console.error("[POST /exp]", err);
        return res.status(500).json({ success: false, message: "Error al sumar EXP" });
    }
});

// ─── GET /api/usuario/estado ────────────────────────────────
// Estado completo de EXP + rango (para polling o recarga)
router.get("/estado", auth, async (req, res) => {
    const idUsuario = req.usuario.id;
    try {
        const [rows] = await db.execute(
            "CALL SP_ObtenerEstadoUsuario(?)",
            [idUsuario]
        );
        return res.json({ success: true, estado: rows[0]?.[0] ?? null });
    } catch (err) {
        console.error("[GET /estado]", err);
        return res.status(500).json({ success: false, message: "Error al obtener estado" });
    }
});

module.exports = router;