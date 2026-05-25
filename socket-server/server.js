require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

//
// ──────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────
//

const allowedOrigins = (process.env.FRONTEND_URL || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const corsOriginFn = (origin, callback) => {
    if (!origin) return callback(null, true);

    if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
    ) {
        return callback(null, true);
    }

    console.log("⛔ CORS bloqueado:", origin);
    return callback(new Error(`CORS bloqueado: ${origin}`));
};

app.use(cors({
    origin: corsOriginFn,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: !allowedOrigins.includes("*"),
    optionsSuccessStatus: 204
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//
// ──────────────────────────────────────────────────────────
// SOCKET.IO
// ──────────────────────────────────────────────────────────
//

const io = new Server(server, {
    cors: {
        origin: corsOriginFn,
        methods: ["GET", "POST"],
        credentials: !allowedOrigins.includes("*")
    }
});

//
// usuarioId -> socket.id
//
const usuarioSockets = new Map();

//
// socket.id -> usuarioId
//
const socketUsuarios = new Map();

io.on("connection", (socket) => {

    console.log("🔌 Socket conectado:", socket.id);

    //
    // ──────────────────────────────────────────────────────
    // REGISTRO DE USUARIO
    // ──────────────────────────────────────────────────────
    //

    socket.on("register", (usuarioId) => {

        if (!usuarioId) return;

        usuarioId = String(usuarioId);

        usuarioSockets.set(usuarioId, socket.id);
        socketUsuarios.set(socket.id, usuarioId);

        console.log(`✅ Usuario ${usuarioId} registrado -> ${socket.id}`);
    });

    //
    // ──────────────────────────────────────────────────────
    // CHATS
    // ──────────────────────────────────────────────────────
    //

    socket.on("joinChat", (chatId) => {

        if (!chatId) return;

        const roomName = "chat_" + chatId;

        socket.join(roomName);

        const roomSize =
            io.sockets.adapter.rooms.get(roomName)?.size || 0;

        console.log(
            `📥 ${socket.id} unido a ${roomName} (${roomSize} usuarios)`
        );
    });

    socket.on("leaveChat", (chatId) => {

        if (!chatId) return;

        const roomName = "chat_" + chatId;

        socket.leave(roomName);

        console.log(`📤 ${socket.id} salió de ${roomName}`);
    });

    socket.on("sendMessage", (data) => {

        if (!data?.chatId) return;

        io.to("chat_" + data.chatId)
            .emit("receiveMessage", data);
    });

    //
    // ──────────────────────────────────────────────────────
    // WEBRTC SIGNALING
    // ──────────────────────────────────────────────────────
    //

    //
    // VIDEO OFFER
    //
    socket.on("videoOffer", ({
        chatId,
        offer,
        from,
        toUsuarioId
    }) => {

        if (!chatId || !offer) return;

        const roomName = "chat_" + chatId;

        console.log(
            `📞 OFFER chat=${chatId} from=${from} to=${toUsuarioId}`
        );

        //
        // Enviar a usuarios del room
        //
        socket.to(roomName).emit("videoOffer", {
            chatId,
            offer,
            from
        });

        //
        // Enviar directo si no está dentro del room
        //
        if (toUsuarioId) {

            const targetSocketId =
                usuarioSockets.get(String(toUsuarioId));

            if (
                targetSocketId &&
                targetSocketId !== socket.id
            ) {

                const targetSocket =
                    io.sockets.sockets.get(targetSocketId);

                if (
                    targetSocket &&
                    !targetSocket.rooms.has(roomName)
                ) {

                    console.log(
                        `📲 Enviando offer directo a ${targetSocketId}`
                    );

                    targetSocket.emit("videoOffer", {
                        chatId,
                        offer,
                        from
                    });
                }
            }
        }
    });

    //
    // VIDEO ANSWER
    //
    socket.on("videoAnswer", ({
        chatId,
        answer,
        from
    }) => {

        if (!chatId || !answer) return;

        console.log(`✅ ANSWER chat=${chatId}`);

        socket.to("chat_" + chatId).emit("videoAnswer", {
            chatId,
            answer,
            from
        });
    });

    //
    // VIDEO FRAME (relay de frames base64)
    //
    socket.on("videoFrame", ({ chatId, frame, from }) => {

        if (!chatId || !frame) return;

        socket.to("chat_" + chatId).emit("videoFrame", { chatId, frame, from });
    });

    //
    // ICE CANDIDATES (se mantiene por compatibilidad)
    //
    socket.on("iceCandidate", ({
        chatId,
        candidate
    }) => {

        if (!chatId || !candidate) return;

        socket.to("chat_" + chatId).emit("iceCandidate", {
            candidate
        });
    });

    //
    // COLGAR
    //
    socket.on("videoHangup", ({ chatId }) => {

        if (!chatId) return;

        console.log(`📵 Hangup chat=${chatId}`);

        socket.to("chat_" + chatId)
            .emit("videoHangup");
    });

    //
    // RECHAZAR
    //
    socket.on("videoRejected", ({ chatId }) => {

        if (!chatId) return;

        console.log(`❌ Rechazada chat=${chatId}`);

        socket.to("chat_" + chatId)
            .emit("videoRejected");
    });

    //
    // ──────────────────────────────────────────────────────
    // DESCONECTAR
    // ──────────────────────────────────────────────────────
    //

    socket.on("disconnect", () => {

        console.log("❌ Socket desconectado:", socket.id);

        const usuarioId = socketUsuarios.get(socket.id);

        if (usuarioId) {

            usuarioSockets.delete(usuarioId);
            socketUsuarios.delete(socket.id);

            console.log(`🧹 Usuario ${usuarioId} eliminado`);
        }
    });
});

//
// ──────────────────────────────────────────────────────────
// RUTAS API
// ──────────────────────────────────────────────────────────
//

app.use("/api/auth", require("./routes/auth"));
app.use("/api/chats", require("./routes/chat"));
app.use("/api/usuario", require("./routes/usuario"));

//
// Rutas opcionales
//
["tareas", "rangos", "coach"].forEach(ruta => {

    try {

        app.use(
            `/api/${ruta}`,
            require(`./routes/${ruta}`)
        );

    } catch (e) {

        console.warn(
            `⚠ Ruta /api/${ruta} no encontrada`
        );
    }
});

//
// ──────────────────────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────────────────────
//

app.get("/", (req, res) => {

    res.json({
        status: "POI API running 🚀"
    });
});

//
// ──────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────
//

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);

    console.log(
        `🌐 Origins permitidos: ${allowedOrigins.join(", ")}`
    );
});