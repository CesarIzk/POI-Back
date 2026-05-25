const router = require("express").Router();
const auth = require("../middleware/auth");
const db = require("../db");

// Todas las rutas de chat requieren JWT
router.use(auth);


// ─── GET /api/chats ──────────────────────────────────────────
// Lista los chats del usuario autenticado
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


// ─── POST /api/chats ─────────────────────────────────────────
// Crea un nuevo chat y agrega al creador como miembro
router.post("/", async (req, res) => {
    const id_usuario = req.usuario.id;
    const { nombre, usuarioDestino } = req.body;

    if (!nombre || nombre.trim() === "") {
        return res.json({ success: false, message: "El nombre del chat es obligatorio" });
    }

    if (nombre.trim().length > 30) {
        return res.json({ success: false, message: "El nombre no puede superar 30 caracteres" });
    }

    try {
        // 1. Crear el chat
        const [rows] = await db.query(
            "CALL SP_CrearChat(?, ?)",
            [id_usuario, nombre.trim()]
        );

        const nuevoIdChat = rows[0][0].NuevoIdChat;

        // 2. Agregar al creador como miembro automáticamente
        await db.query(
            "CALL SP_GestionarMiembroGrupo('INSERT', ?, ?)",
            [nuevoIdChat, id_usuario]
        );

        // 3. Si se seleccionó otro usuario, agregarlo también
        if (usuarioDestino) {
            await db.query(
                "CALL SP_GestionarMiembroGrupo('INSERT', ?, ?)",
                [nuevoIdChat, usuarioDestino]
            );
        }

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


// ─── GET /api/chats/:id/members ─────────────────────────────
// Lista los miembros de un chat
router.get("/:id/members", async (req, res) => {
    const id_chat = req.params.id;
    try {
        const [rows] = await db.query(
            "CALL SP_GestionarMiembroGrupo('SELECT', ?, NULL)",
            [id_chat]
        );
        return res.json(rows[0] ?? []);
    } catch (err) {
        console.error("Error obteniendo miembros:", err);
        return res.json({ success: false, message: "Error al obtener miembros", error: err.message });
    }
});


// ─── POST /api/chats/:id/members ────────────────────────────
// Agrega un usuario al chat
router.post("/:id/members", async (req, res) => {
    const id_chat = req.params.id;
    const { id_usuario } = req.body;

    if (!id_usuario) {
        return res.json({ success: false, message: "id_usuario es obligatorio" });
    }

    try {
        await db.query(
            "CALL SP_GestionarMiembroGrupo('INSERT', ?, ?)",
            [id_chat, id_usuario]
        );
        return res.json({ success: true, message: "Usuario agregado al chat" });
    } catch (err) {
        console.error("Error agregando miembro:", err);
        return res.json({ success: false, message: "Error al agregar miembro", error: err.message });
    }
});


// ─── DELETE /api/chats/:id/members/:userId ───────────────────
// Elimina un usuario del chat (o salir del grupo)
router.delete("/:id/members/:userId", async (req, res) => {
    const id_chat    = req.params.id;
    const id_usuario = req.params.userId;

    try {
        await db.query(
            "CALL SP_GestionarMiembroGrupo('DELETE', ?, ?)",
            [id_chat, id_usuario]
        );
        return res.json({ success: true, message: "Usuario eliminado del chat" });
    } catch (err) {
        console.error("Error eliminando miembro:", err);
        return res.json({ success: false, message: "Error al eliminar miembro", error: err.message });
    }
});


// ─── GET /api/chats/:id/messages ────────────────────────────
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