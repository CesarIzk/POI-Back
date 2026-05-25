require("dotenv").config();
const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");

const app    = express();
const server = http.createServer(app);

// ─── Middlewares ───────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL || "*";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const io = new Server(server, {
    cors: { origin: allowedOrigin, methods: ["GET", "POST"] }
});

// Exponer io a todas las rutas (para emitir desde Express)
app.set("io", io);

// ─── Socket.io ─────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log("Usuario conectado:", socket.id);

    // ── Sala personal del usuario (para EXP en tiempo real) ──
    socket.on("joinUser", (idUsuario) => {
        const sala = `user_${idUsuario}`;
        socket.join(sala);
        console.log(`[joinUser] socket ${socket.id} → sala ${sala}`);
    });

    // ── Chat ──────────────────────────────────────────────
    socket.on("joinChat", (chatId) => {
        const room = "chat_" + chatId;
        socket.join(room);
        console.log(`[joinChat] socket ${socket.id} → sala ${room}`);
    });

    socket.on("sendMessage", (data) => {
        const room = "chat_" + data.chatId;
        io.to(room).emit("receiveMessage", data);
    });

    // ── Señalización WebRTC ───────────────────────────────
    socket.on("videoOffer", ({ chatId, offer, from }) => {
        const roomName = "chat_" + chatId;
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log(`[videoOffer] sala: ${roomName}, miembros: ${room?.size ?? 0}`);
        socket.to(roomName).emit("videoOffer", { chatId, offer, from });
    });

    socket.on("videoAnswer", ({ chatId, answer, from }) => {
        const roomName = "chat_" + chatId;
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log(`[videoAnswer] sala: ${roomName}, miembros: ${room?.size ?? 0}`, [...(room ?? [])]);
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
        console.log("Usuario desconectado:", socket.id);
    });
});

// ─── Rutas ─────────────────────────────────────────────────
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/chats",   require("./routes/chat"));
app.use("/api/usuario", require("./routes/usuario"));
app.use("/api/tareas",  require("./routes/tareas"));
app.use("/api/rangos",  require("./routes/rangos"));
app.use("/api/coach",   require("./routes/coach"));

// ─── Health check ──────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "POI API running 🚀" }));

// ─── Puerto ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});