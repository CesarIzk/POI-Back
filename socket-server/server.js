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

    socket.on("joinChat", (chatId) => {
        const room = "chat_" + chatId;
        socket.join(room);
        console.log("Se unió a:", room);
    });

    socket.on("sendMessage", (data) => {
        const room = "chat_" + data.chatId;
        console.log("Enviando a:", room);
        io.to(room).emit("receiveMessage", data);
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

// ─── Puerto (Railway asigna PORT automáticamente) ──────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});