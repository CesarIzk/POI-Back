const router = require("express").Router();
const auth = require("../middleware/auth");

// ─── GET /api/usuario/me ────────────────────────────────────
// Devuelve los datos del usuario autenticado desde el JWT
// (home.html los usa para mostrar nombre, nivel, exp)
router.get("/me", auth, (req, res) => {
    return res.json({ success: true, usuario: req.usuario });
});

module.exports = router;