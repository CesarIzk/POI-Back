const router = require("express").Router();
const auth   = require("../middleware/auth");
const pool   = require("../db");

// ─── GET /api/tareas/:idUsuario ─────────────────────────────
// Trae todas las tareas del usuario ordenadas por FechaLimite
router.get("/:idUsuario", auth, async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const [rows] = await pool.execute(
            "CALL SP_GestionarTarea('SELECT', NULL, NULL, ?, NULL, NULL, NULL, NULL)",
            [idUsuario]
        );
        // Los SP devuelven el result set en rows[0]
        return res.json({ success: true, tareas: rows[0] });
    } catch (err) {
        console.error("[GET tareas]", err);
        return res.status(500).json({ success: false, message: "Error al obtener tareas" });
    }
});

// ─── PUT /api/tareas/:idTarea ───────────────────────────────
// Actualiza el estatus de una tarea (marcar/desmarcar)
router.put("/:idTarea", auth, async (req, res) => {
    const { idTarea }  = req.params;
    const { estatus }  = req.body;          // boolean

    if (estatus === undefined) {
        return res.status(400).json({ success: false, message: "Falta el campo estatus" });
    }

    try {
        await pool.execute(
            "CALL SP_GestionarTarea('UPDATE', ?, NULL, NULL, NULL, NULL, ?, NULL)",
            [idTarea, estatus ? 1 : 0]
        );
        return res.json({ success: true, message: "Tarea actualizada" });
    } catch (err) {
        console.error("[PUT tarea]", err);
        return res.status(500).json({ success: false, message: "Error al actualizar tarea" });
    }
});

module.exports = router;