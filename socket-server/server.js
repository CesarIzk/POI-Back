require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ─── Middlewares ───────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("Usuario conectado:", socket.id);

    // ── Chat ──────────────────────────────────────────────
    socket.on("joinChat", (chatId) => {
        const room = "chat_" + chatId;
        socket.join(room);
        console.log("Se unió a:", room);
    });

    socket.on("sendMessage", (data) => {
        const room = "chat_" + data.chatId;
        io.to(room).emit("receiveMessage", data);
    });

    // ── Señalización WebRTC ───────────────────────────────

    // 1. Offer (quien llama → quien recibe)
    socket.on("videoOffer", ({ chatId, offer, from }) => {
        socket.to("chat_" + chatId).emit("videoOffer", { chatId, offer, from });
    });

    // 2. Answer (quien recibe → quien llamó)
    socket.on("videoAnswer", ({ chatId, answer, from }) => {
        socket.to("chat_" + chatId).emit("videoAnswer", { chatId, answer, from });
    });

    // 3. ICE candidates (ambos lados)
    socket.on("iceCandidate", ({ chatId, candidate }) => {
        socket.to("chat_" + chatId).emit("iceCandidate", { candidate });
    });

    // 4. Colgar
    socket.on("videoHangup", ({ chatId }) => {
        socket.to("chat_" + chatId).emit("videoHangup");
    });

    // 5. Rechazar
    socket.on("videoRejected", ({ chatId }) => {
        socket.to("chat_" + chatId).emit("videoRejected");
    });

    socket.on("disconnect", () => {
        console.log("Usuario desconectado:", socket.id);
    });
});

// ─── Rutas ─────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chats", require("./routes/chat"));
app.use("/api/usuario", require("./routes/usuario"));

// ─── Health check ──────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "POI API running 🚀" }));

// ─── Puerto ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});