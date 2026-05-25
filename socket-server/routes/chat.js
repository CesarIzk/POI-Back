const router = require("express").Router();
const auth = require("../middleware/auth");
const db = require("../db");

// Todas las rutas de chat requieren JWT
router.use(auth);


// ─── GET /api/chats ─────────────────────────────────────────
// Equivale a ChatController.php?action=list
router.get("/", async (req, res) => {
    const id_usuario = req.usuario.id;

    try {
        const [rows] = await db.query("CALL SP_ObtenerChatUsuario(?)", [id_usuario]);

        return res.json(rows[0] ?? []);

    } catch (err) {
        console.error("Error obteniendo chats:", err);
        return res.json({ success: false, message: "Error al obtener chats", error: err.message });
    }
});

// ─── GET /api/chats/users ────────────────────────────────────
// Lista todos los usuarios activos (para select/dropdown)
router.get("/users", async (req, res) => {
    try {
        const [rows] = await db.query(
            "CALL SP_GestionarUsuario('SELECT', NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
        );

        return res.json(rows[0] ?? []);

    } catch (err) {
        console.error("Error obteniendo usuarios:", err);
        return res.json({ success: false, message: "Error al obtener usuarios", error: err.message });
    }
});

// ─── GET /api/chats/:id/messages ────────────────────────────
// Equivale a ChatController.php?action=messages&id_chat=X
router.get("/:id/messages", async (req, res) => {
    const id_chat = req.params.id;

    try {
        const [rows] = await db.query(
            "CALL SP_GestionarMensaje('SELECT', NULL, ?, NULL, NULL, NULL, NULL, NULL)",
            [id_chat]
        );

        return res.json(rows[0] ?? []);

    } catch (err) {
        console.error("Error obteniendo mensajes:", err);
        return res.json({ success: false, message: "Error al obtener mensajes", error: err.message });
    }
});


// ─── POST /api/chats/:id/messages ───────────────────────────
// Equivale a ChatController.php?action=send
router.post("/:id/messages", async (req, res) => {
    const id_chat    = req.params.id;
    const id_usuario = req.usuario.id;
    const { mensaje } = req.body;

    if (!mensaje) {
        return res.json({ success: false, message: "Mensaje vacío" });
    }

    try {
        await db.query(
            "CALL SP_GestionarMensaje('INSERT', ?, ?, ?, ?, ?, ?, ?)",
            [id_usuario, id_chat, 0, mensaje, null, null, "enviado"]
        );

        return res.json({ success: true });

    } catch (err) {
        console.error("Error enviando mensaje:", err);
        return res.json({ success: false, message: "Error al enviar mensaje", error: err.message });
    }
});

module.exports = router;