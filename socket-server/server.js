require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map(s => s.trim()).filter(Boolean);
            if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
                return callback(null, true);
            }
            return callback(new Error(`CORS blocked: ${origin}`));
        },
        methods: ["GET", "POST"]
    }
});

// ─── Middlewares ───────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  preflightContinue: false,   // ← cors() handles OPTIONS itself
  optionsSuccessStatus: 204
}));

app.use(express.json());         // ← parses JSON request bodies
app.use(express.urlencoded({ extended: true }));

io.on("connection", (socket) => {
    console.log("Usuario conectado:", socket.id);

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

app.get("/api/turn-credentials", async (req, res) => {
    try {
        const response = await fetch(
            `https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
        );
        const iceServers = await response.json();
        res.json({ iceServers });
    } catch (err) {
        console.error("Error obteniendo TURN credentials:", err);
        // Fallback a solo STUN si falla
        res.json({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });
    }
});

// ─── Rutas ─────────────────────────────────────────────────
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/chats",   require("./routes/chat"));
app.use("/api/usuario", require("./routes/usuario"));
app.use("/api/tareas",  require("./routes/tareas"));   // ← NUEVO
app.use("/api/rangos",  require("./routes/rangos"));   // ← NUEVO
app.use("/api/coach",   require("./routes/coach"));    // ← NUEVO

// ─── Health check ──────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "POI API running 🚀" }));

// ─── Puerto ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});