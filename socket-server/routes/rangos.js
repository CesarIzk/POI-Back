const router = require("express").Router();
const auth   = require("../middleware/auth");
const pool   = require("../db");

// ─── GET /api/rangos/:idUsuario ─────────────────────────────
// Trae todos los rangos obtenidos por el usuario
router.get("/:idUsuario", auth, async (req, res) => {
    const { idUsuario } = req.params;
    try {
        const [rows] = await pool.execute(
            "CALL SP_GestionarRangoObtenido('SELECT', ?, NULL)",
            [idUsuario]
        );
        return res.json({ success: true, rangos: rows[0] });
    } catch (err) {
        console.error("[GET rangos]", err);
        return res.status(500).json({ success: false, message: "Error al obtener rangos" });
    }
});

module.exports = router;