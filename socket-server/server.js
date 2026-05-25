require("dotenv").config();
const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");

const app    = express();
const server = http.createServer(app);

// ─── CORS origins ──────────────────────────────────────────
// En Railway agrega FRONTEND_URL=https://tuapp.netlify.app
// Puedes poner varias separadas por coma
const allowedOrigins = (process.env.FRONTEND_URL || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const corsOriginFn = (origin, callback) => {
    // Permitir requests sin origin (Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado: ${origin}`));
};

// ─── Express middlewares ───────────────────────────────────
app.use(cors({
    origin: corsOriginFn,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // credentials solo si NO usas origin: "*"
    credentials: !allowedOrigins.includes("*"),
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Socket.IO ─────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: corsOriginFn,
        methods: ["GET", "POST"],
        credentials: !allowedOrigins.includes("*")
    }
});

// Mapa: usuarioId → socket.id (para notificar llamadas aunque no estén en el room)
const usuarioSockets = new Map();

io.on("connection", (socket) => {
    console.log("🔌 Conectado:", socket.id);

    // El cliente se registra con su id de usuario al conectar
    socket.on("register", (usuarioId) => {
        if (usuarioId) {
            usuarioSockets.set(String(usuarioId), socket.id);
            console.log(`[register] usuario ${usuarioId} → socket ${socket.id}`);
        }
    });

    // ── Chat ──────────────────────────────────────────────
    socket.on("joinChat", (chatId) => {
        const room = "chat_" + chatId;
        socket.join(room);
        console.log(`[joinChat] ${socket.id} → ${room} (miembros: ${io.sockets.adapter.rooms.get(room)?.size ?? 1})`);
    });

    socket.on("sendMessage", (data) => {
        io.to("chat_" + data.chatId).emit("receiveMessage", data);
    });

    // ── Señalización WebRTC ───────────────────────────────

    // Offer: se emite a todos en el room Y directamente al socket del destinatario
    // para que reciba la llamada aunque no tenga el chat abierto
    socket.on("videoOffer", ({ chatId, offer, from, toUsuarioId }) => {
        const roomName = "chat_" + chatId;
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log(`[videoOffer] sala: ${roomName}, miembros: ${room?.size ?? 0}, destino: ${toUsuarioId}`);

        // Emitir al room (excluye al emisor)
        socket.to(roomName).emit("videoOffer", { chatId, offer, from });

        // Si se especificó un destinatario y NO está en el room, notificarle directamente
        if (toUsuarioId) {
            const destSocketId = usuarioSockets.get(String(toUsuarioId));
            if (destSocketId && destSocketId !== socket.id) {
                const destSocket = io.sockets.sockets.get(destSocketId);
                if (destSocket && !destSocket.rooms.has(roomName)) {
                    console.log(`[videoOffer] notificando directamente a socket ${destSocketId}`);
                    destSocket.emit("videoOffer", { chatId, offer, from });
                }
            }
        }
    });

    socket.on("videoAnswer", ({ chatId, answer, from }) => {
        const roomName = "chat_" + chatId;
        console.log(`[videoAnswer] sala: ${roomName}`);
        socket.to(roomName).emit("videoAnswer", { chatId, answer, from });
    });

    socket.on("iceCandidate", ({ chatId, candidate }) => {
        socket.to("chat_" + chatId).emit("iceCandidate", { candidate });
    });

    socket.on("videoHangup", ({ chatId }) => {
        socket.to("chat_" + chatId).emit("videoHangup");
    });

    socket.on("videoRejected", ({ chatId }) => {
        socket.to("chat_" + chatId).emit("videoRejected");
    });

    socket.on("disconnect", () => {
        // Limpiar el registro del usuario
        for (const [uid, sid] of usuarioSockets.entries()) {
            if (sid === socket.id) {
                usuarioSockets.delete(uid);
                console.log(`[disconnect] usuario ${uid} eliminado del mapa`);
                break;
            }
        }
        console.log("❌ Desconectado:", socket.id);
    });
});

// ─── Rutas API ─────────────────────────────────────────────
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/chats",   require("./routes/chat"));
app.use("/api/usuario", require("./routes/usuario"));

// Rutas opcionales — solo se cargan si el archivo existe
["tareas", "rangos", "coach"].forEach(ruta => {
    try {
        app.use(`/api/${ruta}`, require(`./routes/${ruta}`));
    } catch (e) {
        console.warn(`⚠ Ruta /api/${ruta} no encontrada, se omite`);
    }
});

// ─── Health check ──────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "POI API running 🚀" }));

// ─── Puerto ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
    console.log(`🌐 CORS permitido para: ${allowedOrigins.join(", ")}`);
});