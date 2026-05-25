const router = require("express").Router();
const auth = require("../middleware/auth");
const db = require("../db");

// Todas las rutas de chat requieren JWT
router.use(auth);


// ─── POST /api/chats ─────────────────────────────────────────
// Crea un nuevo chat
router.post("/", async (req, res) => {
    const id_usuario = req.usuario.id;
    const { nombre } = req.body;

    if (!nombre || nombre.trim() === "") {
        return res.json({ success: false, message: "El nombre del chat es obligatorio" });
    }

    if (nombre.trim().length > 30) {
        return res.json({ success: false, message: "El nombre no puede superar 30 caracteres" });
    }

    try {
        const [rows] = await db.query(
            "CALL SP_CrearChat(?, ?)",
            [id_usuario, nombre.trim()]
        );

        const nuevoIdChat = rows[0][0].NuevoIdChat;

        return res.json({ success: true, id_chat: nuevoIdChat, message: "Chat creado correctamente" });

    } catch (err) {
        console.error("Error creando chat:", err);
        return res.json({ success: false, message: "Error al crear chat", error: err.message });
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